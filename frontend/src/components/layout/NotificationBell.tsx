'use client';

import { ActionIcon, Badge, Popover, useMantineColorScheme, useMantineTheme } from '@mantine/core';
import { IconBell, IconBellOff } from '@tabler/icons-react';
import { useUnreadCount } from '@/hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationAlertSettings } from '@/hooks/useNotificationAlertSettings';
import { primeNotificationSound } from '@/lib/notifications/sound';

export function NotificationBell() {
  const [opened, { close, toggle }] = useDisclosure(false);
  const { data: unreadCount = 0 } = useUnreadCount();
  const { user } = useAuth();
  const { alertsEnabled, toggleAlertsEnabled } = useNotificationAlertSettings(user?.id);
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isMobileNav = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

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
          size={isMobileNav ? 'md' : 'lg'}
          onClick={() => {
            void primeNotificationSound();
            toggle();
          }}
          style={{ position: 'relative' }}
        >
          {alertsEnabled ? <IconBell size={isMobileNav ? 18 : 20} /> : <IconBellOff size={isMobileNav ? 18 : 20} />}
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
      <Popover.Dropdown
        p={0}
        bg={colorScheme === 'dark' ? theme.colors.dark[7] : undefined}
        style={{ width: '380px', maxHeight: '500px', overflow: 'hidden' }}
      >
        <NotificationDropdown
          onClose={close}
          alertsEnabled={alertsEnabled}
          onToggleAlerts={toggleAlertsEnabled}
        />
      </Popover.Dropdown>
    </Popover>
  );
}



