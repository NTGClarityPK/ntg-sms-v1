'use client';

import { Avatar, Menu, Text, Group } from '@mantine/core';
import { IconUser, IconSettings, IconLogout } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';

export function UserMenu() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // Intentionally swallow; auth util handles redirect/session cleanup
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
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={14} />}
          onClick={handleLogout}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

