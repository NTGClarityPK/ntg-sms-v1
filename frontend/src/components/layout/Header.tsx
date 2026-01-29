'use client';

import { useEffect, useState } from 'react';
import { Group, Text, Badge, Tooltip } from '@mantine/core';
import { IconCircle } from '@tabler/icons-react';
import { UserMenu } from './UserMenu';
import { BranchSwitcher } from '@/components/features/branches/BranchSwitcher';
import { NotificationBell } from './NotificationBell';
import { useSuccessColor, useErrorColor } from '@/lib/hooks/use-theme-colors';

export function Header() {
  const successColor = useSuccessColor();
  const errorColor = useErrorColor();
  const [isOnline, setIsOnline] = useState<boolean>(true);

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
      <Text fw={600} size="lg">
        School Management System
      </Text>

      <Group gap="md" align="center">
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

