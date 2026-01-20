'use client';

import { Group, Text, ActionIcon } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { UserMenu } from './UserMenu';

export function Header() {
  return (
    <Group justify="space-between" style={{ flex: 1 }}>
      <Text fw={600} size="lg">
        School Management System
      </Text>

      <Group gap="md">
        <ActionIcon variant="subtle" size="lg">
          <IconBell size={20} />
        </ActionIcon>
        <UserMenu />
      </Group>
    </Group>
  );
}

