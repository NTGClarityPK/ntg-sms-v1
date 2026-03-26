'use client';

import { useEffect, useState } from 'react';
import { Avatar, Menu, Text, Group } from '@mantine/core';
import {
  IconUser,
  IconBook,
  IconLogout,
  IconSwitchHorizontal,
  IconDownload,
  IconBell,
  IconCompass,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { useInstallApp } from '@/lib/install-app-context';
import { BranchSelectionModal } from '@/components/common/BranchSelectionModal';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth';
import { OnboardingToursModal } from '@/components/onboarding/OnboardingToursModal';
import {
  clearOpenToursModalRequested,
  useOnboardingStore,
} from '@/lib/store/onboarding-store';
import { useSystemSetting } from '@/hooks/useSystemSettings';

interface Branch {
  id: string;
  name: string;
  code: string;
  tenantId: string;
}

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, refetch } = useAuth();
  const userTyped = user as User | undefined;
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [toursModalOpened, setToursModalOpened] = useState(false);
  const helpUrl = 'https://ntg-1.gitbook.io/ntg-sms-user-docs/';
  const openToursModalRequested = useOnboardingStore((s) => s.openToursModalRequested);
  const autoOpenSetting = useSystemSetting<boolean>('guided_tours_auto_open_enabled');

  const autoOpenEnabled = autoOpenSetting.data?.data?.value === true;
  const hasSeenToursModal = userTyped?.onboardingSeenToursModal === true;

  const branches = Array.from(
    new Map(((userTyped?.branches || []) as Branch[]).map((b) => [b.id, b])).values(),
  );
  const hasMultipleBranches = branches.length > 1;
  const isSchoolAdmin =
    userTyped?.roles?.some((r) => r.roleName?.toLowerCase() === 'school_admin') || false;
  const { promptInstall, canInstallDirectly, isSafari, isInstalled, setShowSafariModal } = useInstallApp();

  const handleInstallApp = () => {
    if (canInstallDirectly) {
      void promptInstall();
    } else if (isSafari && !isInstalled) {
      setShowSafariModal(true);
    }
  };

  const showInstallApp = !isInstalled && (canInstallDirectly || isSafari);

  useEffect(() => {
    if (!openToursModalRequested) return;
    setToursModalOpened(true);
    clearOpenToursModalRequested();
  }, [openToursModalRequested]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!autoOpenEnabled) return;
    if (hasSeenToursModal) return;

    const key = 'ntg_alma_show_tours_modal';
    const shouldOpen = window.sessionStorage.getItem(key) === '1';
    if (!shouldOpen) return;

    window.sessionStorage.removeItem(key);
    setToursModalOpened(true);
  }, [autoOpenEnabled, hasSeenToursModal]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // Intentionally swallow; auth util handles redirect/session cleanup
    }
  };

  const handleSwitchBranch = () => {
    setShowBranchModal(true);
  };

  const handleBranchSelection = async (branchId: string) => {
    setIsSwitching(true);
    try {
      // Update the selected branch on the backend
      await apiClient.post('/api/v1/auth/select-branch', { branchId });
      
      // Store in localStorage
      localStorage.setItem('currentBranchId', branchId);
      
      // Refetch user data
      await refetch();
      
      // Close modal
      setShowBranchModal(false);
      
      // Invalidate only branch-dependent queries (preserves cache for non-branch data)
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['class-sections'] });
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['early-departures'] });
      
      // Use SPA navigation (preserves React Query cache)
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to switch branch:', error);
      setIsSwitching(false);
    }
  };

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Group id="user-menu-trigger" gap="xs" style={{ cursor: 'pointer' }}>
          <Avatar color="blue" radius="xl">
            {initials}
          </Avatar>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={500} truncate>
              {user?.fullName || user?.email}
            </Text>
            {user?.email && (
              <Text size="xs" c="dimmed" truncate>
                {user.email}
              </Text>
            )}
          </div>
        </Group>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Account</Menu.Label>
        <Menu.Item
          id="user-menu-profile"
          leftSection={<IconUser size={14} />}
          onClick={() => {
            router.push('/profile');
          }}
        >
          Profile
        </Menu.Item>
        <Menu.Item
          id="user-menu-help"
          leftSection={<IconBook size={14} />}
          component="a"
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Help
        </Menu.Item>
        <Menu.Item
          id="user-menu-enable-notifications"
          leftSection={<IconBell size={14} />}
          onClick={() => {
            router.push('/notifications?tab=settings');
          }}
        >
          Enable Notifications
        </Menu.Item>

        {showInstallApp && (
          <Menu.Item
            id="user-menu-install-app"
            leftSection={<IconDownload size={14} />}
            onClick={handleInstallApp}
          >
            Install app
          </Menu.Item>
        )}
        
        {hasMultipleBranches && isSchoolAdmin && (
          <>
            <Menu.Divider />
            <Menu.Item
              id="user-menu-switch-branch"
              leftSection={<IconSwitchHorizontal size={14} />}
              onClick={handleSwitchBranch}
            >
              Switch Branch
            </Menu.Item>
          </>
        )}

        <Menu.Divider />
        <Menu.Item
          id="user-menu-take-a-tour"
          leftSection={<IconCompass size={14} />}
          onClick={() => setToursModalOpened(true)}
        >
          Take a tour
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item
          id="user-menu-logout"
          color="red"
          leftSection={<IconLogout size={14} />}
          onClick={handleLogout}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>

      <BranchSelectionModal
        opened={showBranchModal}
        branches={branches}
        onSelect={handleBranchSelection}
        loading={isSwitching}
        allowClose={true}
        onClose={() => setShowBranchModal(false)}
      />

      <OnboardingToursModal opened={toursModalOpened} onClose={() => setToursModalOpened(false)} />
    </Menu>
  );
}

