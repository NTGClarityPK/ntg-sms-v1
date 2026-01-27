'use client';

import { Group, Text } from '@mantine/core';
import { UserMenu } from './UserMenu';
import { BranchSwitcher } from '@/components/features/branches/BranchSwitcher';
import { NotificationBell } from './NotificationBell';

export function Header() {
  return (
    <Group justify="space-between" style={{ flex: 1 }}>
      <Text fw={600} size="lg">
        School Management System
      </Text>

      <Group gap="md">
        <BranchSwitcher />
        <NotificationBell />
        <UserMenu />
      </Group>
    </Group>
  );
}

