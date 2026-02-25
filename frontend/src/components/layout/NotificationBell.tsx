'use client';

import { ActionIcon, Badge, Popover } from '@mantine/core';
import { IconBell, IconBellOff } from '@tabler/icons-react';
import { useUnreadCount } from '@/hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationAlertSettings } from '@/hooks/useNotificationAlertSettings';
import { primeNotificationSound } from '@/lib/notifications/sound';

export function NotificationBell() {
  const [opened, { close, toggle }] = useDisclosure(false);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { user } = useAuth();
  const { alertsEnabled, toggleAlertsEnabled } = useNotificationAlertSettings(user?.id);

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
          onClick={() => {
            void primeNotificationSound();
            toggle();
          }}
          style={{ position: 'relative' }}
        >
          {alertsEnabled ? <IconBell size={20} /> : <IconBellOff size={20} />}
          {unreadCount > 0 && (
            <Badge
              size="xs"
              variant="filled"
              color="red"
              style={{
                position: 'absolute',
                top: 0,
                insetInlineEnd: 0,
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
      <Popover.Dropdown p={0} style={{ width: '380px', maxHeight: '500px', overflow: 'hidden' }}>
        <NotificationDropdown
          onClose={close}
          alertsEnabled={alertsEnabled}
          onToggleAlerts={toggleAlertsEnabled}
        />
      </Popover.Dropdown>
    </Popover>
  );
}



