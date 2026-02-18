'use client';

import {
  Stack,
  Text,
  Button,
  Group,
  Paper,
  Badge,
  Skeleton,
  ScrollArea,
  Divider,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconChecks, IconBell, IconBellOff } from '@tabler/icons-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/types/notifications';

interface NotificationDropdownProps {
  onClose: () => void;
  alertsEnabled: boolean;
  onToggleAlerts: () => void;
}

export function NotificationDropdown({
  onClose,
  alertsEnabled,
  onToggleAlerts,
}: NotificationDropdownProps) {
  const router = useRouter();
  const notifyColors = useThemeColors();
  const { data: notificationsData, isLoading } = useNotifications({
    limit: 20,
  });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Show the latest few notifications (read + unread). The red bubble on the bell
  // still reflects the unread count via useUnreadCount.
  const allNotifications = notificationsData?.data || [];
  const notifications = allNotifications.slice(0, 5);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }

    // Navigate based on notification type and data
    if (notification.type === 'attendance' && notification.data) {
      const studentId = notification.data.studentId as string;
      const date = notification.data.date as string;
      router.push(`/attendance/child?date=${date}`);
    } else if (notification.type === 'leave' && notification.data) {
      router.push('/leaves');
    } else if (notification.type === 'grade' && notification.data) {
      router.push('/grades');
    } else if (
      (notification.type === 'early_departure' ||
        notification.type === 'early_departure_request_raised' ||
        notification.type === 'early_departure_excused') &&
      notification.data
    ) {
      router.push('/early-departure');
    } else if (notification.type === 'message' && notification.data) {
      const conversationId = notification.data.conversationId as string | undefined;
      if (conversationId) router.push(`/messages?conversation=${conversationId}`);
    }

    onClose();
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'attendance':
        return notifyColors.info;
      case 'leave':
      case 'early_departure':
      case 'early_departure_request_raised':
      case 'early_departure_excused':
        return notifyColors.warning;
      case 'grade':
      case 'assessment_read':
        return notifyColors.success;
      case 'event':
      case 'event_created':
      case 'event_updated':
        return notifyColors.primary;
      case 'message':
        return notifyColors.info;
      default:
        return notifyColors.primary;
    }
  };

  return (
    <Stack gap={0} p="md" style={{ maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconBell size={18} />
          <Text fw={500} size="sm">
            Notifications
          </Text>
          {notifications.length > 0 && (
            <Badge variant="light" size="sm" color={notifyColors.primary}>
              {notifications.length}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          <Tooltip
            label={alertsEnabled ? 'Disable notification alerts' : 'Enable notification alerts'}
            position="bottom"
            withArrow
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onToggleAlerts}
              aria-label={alertsEnabled ? 'Disable notification alerts' : 'Enable notification alerts'}
            >
              {alertsEnabled ? <IconBell size={16} /> : <IconBellOff size={16} />}
            </ActionIcon>
          </Tooltip>

          {notifications.length > 0 && (
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconChecks size={14} />}
              onClick={() => {
                markAllAsRead.mutate();
              }}
              loading={markAllAsRead.isPending}
            >
              Mark all read
            </Button>
          )}
        </Group>
      </Group>

      <Divider mb="sm" />

      {isLoading ? (
        <Stack gap="md" py="xl">
          <Skeleton height={40} width="80%" />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </Stack>
      ) : notifications.length === 0 ? (
        <Stack align="center" gap="sm" py="xl">
          <IconBell size={32} style={{ opacity: 0.3 }} />
          <Text size="sm" c="dimmed">
            No new notifications
          </Text>
        </Stack>
      ) : (
        <ScrollArea style={{ maxHeight: '350px', flex: 1 }}>
          <Stack gap="xs">
            {notifications.map((notification) => (
              <Paper
                key={notification.id}
                p="sm"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => handleNotificationClick(notification)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'var(--mantine-color-gray-0)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Group justify="space-between" align="flex-start" gap="xs">
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Group gap="xs" align="center">
                      <Badge
                        variant="light"
                        size="xs"
                        color={getTypeColor(notification.type)}
                      >
                        {notification.type}
                      </Badge>
                      {notification.isCritical && (
                        <Badge variant="filled" size="xs" color="red">
                          Critical
                        </Badge>
                      )}
                      <Text fw={500} size="sm" lineClamp={1}>
                        {notification.title}
                      </Text>
                    </Group>
                    {notification.body && (
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {notification.body}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      {new Date(notification.createdAt).toLocaleString()}
                    </Text>
                  </Stack>
                  {!notification.isRead && (
                    <Button
                      variant="subtle"
                      size="xs"
                      p={4}
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead.mutate(notification.id);
                      }}
                      loading={markAsRead.isPending}
                    >
                      <IconCheck size={14} />
                    </Button>
                  )}
                </Group>
              </Paper>
            ))}
          </Stack>
        </ScrollArea>
      )}

      {notifications.length > 0 && (
        <>
          <Divider my="sm" />
          <Button
            variant="light"
            fullWidth
            size="sm"
            onClick={() => {
              router.push('/notifications');
              onClose();
            }}
          >
            View All Notifications
          </Button>
        </>
      )}
    </Stack>
  );
}

