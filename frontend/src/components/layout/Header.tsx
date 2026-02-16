'use client';

import { useEffect, useState } from 'react';
import { Group, Text, Badge, Tooltip, Box, Image, Menu } from '@mantine/core';
import { IconCircle, IconSchool, IconCrown } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { UserMenu } from './UserMenu';
import { CurrentBranchBadge } from '@/components/features/branches/CurrentBranchBadge';
import { NotificationBell } from './NotificationBell';
import { useThemeColors, useSuccessColor, useErrorColor } from '@/lib/hooks/use-theme-colors';
import { useTenantMe } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';
import { useMyStudent } from '@/hooks/useStudents';
import { useTenantBrandingStore } from '@/lib/store/tenant-branding-store';
import { useThemeStore } from '@/lib/store/theme-store';
import { DEFAULT_THEME_COLOR } from '@/lib/utils/theme';

export function Header() {
  const colors = useThemeColors();
  const successColor = useSuccessColor();
  const errorColor = useErrorColor();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const tenantQuery = useTenantMe();
  const { name: tenantName, logoUrl: tenantLogo, setBranding } = useTenantBrandingStore();
  const { setPrimaryColor } = useThemeStore();
  const { user } = useAuth();
  const router = useRouter();
  
  // Check if user is super admin
  const isSuperAdmin = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'super_admin') || false;
  
  // Check if user is a student and get class name
  const isStudent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'student') || false;
  const { data: myStudentData } = useMyStudent();
  const studentClassName = myStudentData?.data?.className && myStudentData?.data?.sectionName
    ? `${myStudentData.data.className} - ${myStudentData.data.sectionName}`
    : null;

  useEffect(() => {
    const data = tenantQuery.data?.data;
    if (!data) return;

    setBranding({
      name: data.name || 'School',
      logoUrl: data.logoUrl || null,
    });
    setPrimaryColor(data.primaryColor || DEFAULT_THEME_COLOR);
  }, [tenantQuery.data?.data, setBranding, setPrimaryColor]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateStatus = () => {
      setIsOnline(window.navigator.onLine);
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return (
    <Group justify="space-between" style={{ flex: 1 }}>
      <Group gap="sm" align="center">
        <Group gap="xs" align="center">
          <Box
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {tenantLogo ? (
              <Image
                src={tenantLogo}
                alt={tenantName || 'School logo'}
                width="100%"
                height="100%"
                fit="contain"
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <IconSchool size={26} stroke={1.5} />
            )}
          </Box>
          <div>
            <Text fw={700} size="lg" style={{ lineHeight: 1 }}>
              {tenantName || 'School'}
            </Text>
            <Text size="xs" c="dimmed" style={{ lineHeight: 1 }}>
              School Management System
            </Text>
          </div>
        </Group>
        {isStudent && studentClassName && (
          <Badge variant="light" color={colors.primary} size="lg">
            {studentClassName}
          </Badge>
        )}
      </Group>

      <Group gap="md" align="center">
        {/* Super Admin Badge */}
        {isSuperAdmin && (
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Badge
                variant="filled"
                color="yellow"
                size="lg"
                leftSection={<IconCrown size={14} />}
                style={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  color: '#000',
                  border: '1px solid #FFD700',
                }}
              >
                SUPER USER
              </Badge>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => router.push('/admin/assign-branch')}>
                Assign Branch to Tenant
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}

        {/* NTG Logo */}
        <Box
          style={{
            width: '64px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 0.9,
          }}
          component="a"
          href="https://ntgclarity.com/"
          target="_blank"
          rel="noopener noreferrer"
          title="NTG Clarity"
        >
          <Image
            src="/ntg-logo.svg"
            alt="NTG Clarity"
            width="100%"
            height="100%"
            fit="contain"
            style={{ objectFit: 'contain' }}
          />
        </Box>

        {/* Online/Offline Status Badge (RMS-style) */}
        <Tooltip
          label={isOnline ? 'Connected to server' : 'No internet connection'}
          position="bottom"
          withArrow
        >
          <Badge
            variant="light"
            color={isOnline ? successColor : errorColor}
            size="sm"
            leftSection={
              <IconCircle
                size={8}
                fill="currentColor"
                style={{ marginRight: 4 }}
              />
            }
            style={{
              cursor: 'default',
              fontWeight: 500,
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </Tooltip>

        <CurrentBranchBadge />
        <NotificationBell />
        <UserMenu />
      </Group>
    </Group>
  );
}

