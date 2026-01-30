'use client';

import { useState } from 'react';
import { Avatar, Menu, Text, Group } from '@mantine/core';
import { IconUser, IconSettings, IconLogout, IconSwitchHorizontal } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { BranchSelectionModal } from '@/components/common/BranchSelectionModal';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth';

interface Branch {
  id: string;
  name: string;
  code: string;
  tenantId: string;
}

export function UserMenu() {
  const { user, refetch } = useAuth();
  const userTyped = user as User | undefined;
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const branches = (userTyped?.branches || []) as Branch[];
  const hasMultipleBranches = branches.length > 1;

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
      
      // Redirect to dashboard to refresh context
      window.location.href = '/dashboard';
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
        <Group gap="xs" style={{ cursor: 'pointer' }}>
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
        <Menu.Item leftSection={<IconUser size={14} />} disabled>
          Profile
        </Menu.Item>
        <Menu.Item leftSection={<IconSettings size={14} />} disabled>
          Settings
        </Menu.Item>
        
        {hasMultipleBranches && (
          <>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconSwitchHorizontal size={14} />}
              onClick={handleSwitchBranch}
            >
              Switch Branch
            </Menu.Item>
          </>
        )}
        
        <Menu.Divider />
        <Menu.Item
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
    </Menu>
  );
}

