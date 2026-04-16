'use client';

import { useTranslations } from 'next-intl';
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
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { IconCheck, IconChecks, IconBell, IconBellOff, IconBellRinging } from '@tabler/icons-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { usePushSubscribe } from '@/hooks/usePushSubscribe';
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
  const t = useTranslations('notification');
  const router = useRouter();
  const mantineTheme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const notifyColors = useThemeColors();
  const notificationRowHoverBg =
    colorScheme === 'dark' ? mantineTheme.colors.dark[5] : mantineTheme.colors.gray[0];
  const { data: notificationsData, isLoading } = useNotifications({
    limit: 20,
  });
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const {
    requestSubscribe,
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isSubscribing: pushSubscribing,
    isLoading: pushLoading,
  } = usePushSubscribe();

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
    } else if (
      (notification.type === 'event' ||
        notification.type === 'event_created' ||
        notification.type === 'event_updated' ||
        notification.type === 'event_consent_submitted') &&
      notification.data
    ) {
      const eventId = notification.data.eventId as string | undefined;
      router.push(eventId ? `/events/${eventId}` : '/events');
    } else if (notification.type === 'message' && notification.data) {
      const conversationId = notification.data.conversationId as string | undefined;
      if (conversationId) router.push(`/messages?conversation=${conversationId}`);
    } else if (notification.type === 'assessment_read' && notification.data) {
      const assessmentId = notification.data.assessmentId as string | undefined;
      router.push(assessmentId ? `/assessments/${assessmentId}/statistics` : '/assessments');
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
            {t('dropdownTitle')}
          </Text>
          {notifications.length > 0 && (
            <Badge variant="light" size="sm" color={notifyColors.primary}>
              {notifications.length}
            </Badge>
          )}
        </Group>
        <Group gap="xs">
          <Tooltip
            label={alertsEnabled ? t('disableAlertsTooltip') : t('enableAlertsTooltip')}
            position="bottom"
            withArrow
          >
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onToggleAlerts}
              aria-label={alertsEnabled ? t('disableAlertsTooltip') : t('enableAlertsTooltip')}
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
              {t('markAllRead')}
            </Button>
          )}
        </Group>
      </Group>

      <Divider mb="sm" />

      {(() => {
        const disabled =
          !pushSupported ||
          pushSubscribing ||
          (pushPermission === 'granted' && pushSubscribed);

        return (
          <Button
            variant="light"
            fullWidth
            size="sm"
            leftSection={<IconBellRinging size={16} />}
            onClick={() => requestSubscribe()}
            disabled={disabled}
            loading={!disabled && pushLoading}
            mb="sm"
          >
            {t('enablePushNotifications')}
          </Button>
        );
      })()}

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
            {t('noNewNotifications')}
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
                onClick={() => handleNotificationClick(notification)}
                styles={{
                  root: {
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: notificationRowHoverBg,
                    },
                  },
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
                          {t('critical')}
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
            {t('viewAllNotifications')}
          </Button>
        </>
      )}
    </Stack>
  );
}

