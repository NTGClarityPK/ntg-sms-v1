'use client';

import { useEffect, useState } from 'react';
import { Group, Text, Badge, Tooltip, Box, Image, Skeleton } from '@mantine/core';
import { IconCircle } from '@tabler/icons-react';
import { UserMenu } from './UserMenu';
import { BranchSwitcher } from '@/components/features/branches/BranchSwitcher';
import { NotificationBell } from './NotificationBell';
import { useSuccessColor, useErrorColor } from '@/lib/hooks/use-theme-colors';
import { useTenantMe } from '@/hooks/useTenant';

export function Header() {
  const successColor = useSuccessColor();
  const errorColor = useErrorColor();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const tenantQuery = useTenantMe();
  const tenantName = tenantQuery.data?.data?.name;

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
      {tenantQuery.isLoading ? (
        <Skeleton height={22} width={220} />
      ) : (
        <Text fw={600} size="lg">
          {tenantName || 'School Management System'}
        </Text>
      )}

      <Group gap="md" align="center">
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

        <BranchSwitcher />
        <NotificationBell />
        <UserMenu />
      </Group>
    </Group>
  );
}

