'use client';

import {
  Stack,
  Text,
  Button,
  Group,
  Paper,
  Badge,
  Loader,
  ScrollArea,
  Divider,
} from '@mantine/core';
import { IconCheck, IconChecks, IconBell } from '@tabler/icons-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/types/notifications';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const router = useRouter();
  const notifyColors = useThemeColors();
  const { data: notificationsData, isLoading } = useNotifications({
    isRead: false,
    limit: 10,
  });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = notificationsData?.data || [];

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
      // Future: Navigate to leave request page
      router.push('/leaves');
    } else if (notification.type === 'grade' && notification.data) {
      // Future: Navigate to grades page
      router.push('/grades');
    }

    onClose();
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'attendance':
        return notifyColors.info;
      case 'leave':
        return notifyColors.warning;
      case 'grade':
        return notifyColors.success;
      case 'event':
        return notifyColors.primary;
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

      <Divider mb="sm" />

      {isLoading ? (
        <Stack align="center" gap="md" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Loading notifications...
          </Text>
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

