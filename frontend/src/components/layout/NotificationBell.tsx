'use client';

import { ActionIcon, Badge, Popover, Stack, Text } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useUnreadCount } from '@/hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';
import { useDisclosure } from '@mantine/hooks';

export function NotificationBell() {
  const [opened, { close, toggle }] = useDisclosure(false);
  const { data: unreadCount = 0 } = useUnreadCount();

  return (
    <Popover
      position="bottom-end"
      withArrow
      shadow="md"
      opened={opened}
      onClose={close}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          size="lg"
          onClick={toggle}
          style={{ position: 'relative' }}
        >
          <IconBell size={20} />
          {unreadCount > 0 && (
            <Badge
              size="xs"
              variant="filled"
              color="red"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                minWidth: '18px',
                height: '18px',
                padding: 0,
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown p={0} style={{ width: '360px', maxHeight: '500px' }}>
        <NotificationDropdown onClose={close} />
      </Popover.Dropdown>
    </Popover>
  );
}

