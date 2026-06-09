'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Group,
  Title,
  Stack,
  Paper,
  Text,
  Badge,
  Button,
  Table,
  Box,
  Skeleton,
  Chip,
  Tabs,
  Alert,
  Loader,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconBell, IconChecks, IconBellRinging, IconBellOff, IconSettings, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { usePushSubscribe } from '@/hooks/usePushSubscribe';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Notification } from '@/types/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { useMantineTheme } from '@mantine/core';

export default function NotificationsPage() {
  const t = useTranslations('notification');
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const notifyColors = useThemeColors();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const initialTab = searchParams?.get('tab') === 'settings' ? 'settings' : 'all';
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const {
    requestSubscribe,
    disablePush,
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    isSubscribing: pushSubscribing,
  } = usePushSubscribe();

  const queryClient = useQueryClient();
  const { data: allNotificationsData, isLoading: isLoadingAll, isRefetching } = useNotifications({
    limit: 100,
  });

  // allNotificationsData is ApiResponse<Notification[]> | null
  const allNotifications: Notification[] = allNotificationsData
    ? (allNotificationsData as unknown as { data: Notification[] }).data
    : [];

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;
  const readCount = allNotifications.filter((n) => n.isRead).length;
  const attendanceCount = allNotifications.filter((n) => n.type === 'attendance').length;

  const filteredNotifications = useMemo(() => {
    if (selectedFilters.length === 0) return allNotifications;
    return allNotifications.filter((n) =>
      selectedFilters.some(
        (f) =>
          (f === 'unread' && !n.isRead) ||
          (f === 'read' && n.isRead) ||
          (f === 'attendance' && n.type === 'attendance'),
      ),
    );
  }, [allNotifications, selectedFilters]);

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
      case 'assessment_published':
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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }

    if (notification.type === 'attendance' && notification.data) {
      const studentId = notification.data.studentId as string;
      const date = notification.data.date as string;
      router.push(`/attendance/child?date=${date}`);
    } else if (notification.type === 'leave' && notification.data) {
      router.push('/leaves');
    } else if (notification.type === 'grade' && notification.data) {
      router.push('/grades');
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
    } else if (notification.type === 'assessment_published') {
      router.push('/my-assessments');
    }
  };

  const renderNotificationsTable = (notifications: Notification[], isLoading: boolean) => {
    if (isLoading) {
      return (
        <Stack gap="md" py="xl">
          <Skeleton height={40} width="30%" />
          <Skeleton height={300} />
          <Skeleton height={50} />
        </Stack>
      );
    }

    if (notifications.length === 0) {
      return (
        <Stack align="center" gap="sm" py="xl">
          <IconBell size={48} style={{ opacity: 0.3 }} />
          <Text c="dimmed">{t('noNotificationsFound')}</Text>
        </Stack>
      );
    }

    return (
      <Box style={{ overflow: 'hidden' }}>
        <Table.ScrollContainer minWidth={640}>
          <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('type')}</Table.Th>
            <Table.Th>{t('tableTitle')}</Table.Th>
            <Table.Th>{t('body')}</Table.Th>
            <Table.Th>{t('date')}</Table.Th>
            <Table.Th>{t('status')}</Table.Th>
            <Table.Th>{t('actions')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {notifications.map((notification) => (
            <Table.Tr
              key={notification.id}
              style={{ cursor: 'pointer' }}
              onClick={() => handleNotificationClick(notification)}
            >
              <Table.Td>
                <Group gap="xs">
                  <Badge variant="light" color={getTypeColor(notification.type)}>
                    {notification.type}
                  </Badge>
                  {notification.isCritical && (
                    <Badge variant="filled" color="red" size="sm">
                      {t('critical')}
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text fw={notification.isRead ? 400 : 600}>
                  {notification.title}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {notification.body || '-'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">
                  {new Date(notification.createdAt).toLocaleString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  variant="light"
                  color={notification.isRead ? 'gray' : notifyColors.primary}
                >
                  {notification.isRead ? t('read') : t('unread')}
                </Badge>
              </Table.Td>
              <Table.Td>
                {!notification.isRead && (
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead.mutate(notification.id);
                    }}
                    loading={markAsRead.isPending}
                  >
                    {t('markRead')}
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Box>
    );
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" gap="xs">
          <Title order={1} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('title')}
          </Title>
          <Group gap="sm">
            <Tooltip label={t('refresh')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={isRefetching}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {unreadCount > 0 && (
              isMobile ? (
                <Tooltip label={t('markAllAsRead')}>
                  <ActionIcon
                    variant="light"
                    size="lg"
                    loading={markAllAsRead.isPending}
                    onClick={() => markAllAsRead.mutate()}
                    aria-label={t('markAllAsRead')}
                  >
                    <IconChecks size={18} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <Button
                  leftSection={<IconChecks size={18} />}
                  onClick={() => markAllAsRead.mutate()}
                  loading={markAllAsRead.isPending}
                >
                  {t('markAllAsRead')}
                </Button>
              )
            )}
          </Group>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Tabs value={activeTab} onChange={setActiveTab} orientation="horizontal" keepMounted={false}>
          <Tabs.List style={{ flexWrap: 'nowrap' }}>
            <Tabs.Tab value="all" leftSection={<IconBell size={16} />}>
              {t('tabAll')}
            </Tabs.Tab>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              {t('tabSettings')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="all" pt="md">
            <Paper withBorder p="md">
              <Paper p="sm" withBorder mb="md">
                <Group gap="xs" wrap="wrap" className="filter-chip-group">
                  <Chip
                    checked={selectedFilters.length === 0}
                    onChange={() => setSelectedFilters([])}
                    variant="filled"
                  >
                    {t('filterAll')} ({allNotifications.length})
                  </Chip>
                  <Chip.Group multiple value={selectedFilters} onChange={setSelectedFilters}>
                    <Group gap="xs" wrap="wrap">
                      <Chip value="unread" variant="filled">
                        {t('filterUnread')} ({unreadCount})
                      </Chip>
                      <Chip value="read" variant="filled">
                        {t('filterRead')} ({readCount})
                      </Chip>
                      <Chip value="attendance" variant="filled">
                        {t('filterAttendance')} ({attendanceCount})
                      </Chip>
                    </Group>
                  </Chip.Group>
                </Group>
              </Paper>
              {renderNotificationsTable(filteredNotifications, isLoadingAll || isRefetching)}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="settings" pt="md">
            <Paper withBorder p="md">
              <Stack gap="md">
                <Title order={3}>{t('pushNotifications')}</Title>
                <Text size="sm" c="dimmed">
                  {t('pushDescription')}
                </Text>
                {!pushSupported && (
                  <Alert color="gray">
                    {t('pushNotSupported')}
                  </Alert>
                )}
                {pushSupported && (
                  <Stack gap="sm">
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{t('permission')}</Text>
                      <Badge variant="light" color={pushPermission === 'granted' ? 'green' : pushPermission === 'denied' ? 'red' : 'gray'}>
                        {pushPermission}
                      </Badge>
                    </Group>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{t('pushSubscribed')}</Text>
                      {pushSubscribing ? (
                        <Group gap="xs">
                          <Loader size="sm" />
                          <Text size="sm" c="dimmed">{t('subscribing')}</Text>
                        </Group>
                      ) : (
                        <Badge variant="light" color={pushSubscribed ? 'green' : 'gray'}>
                          {pushSubscribed ? t('yes') : t('no')}
                        </Badge>
                      )}
                    </Group>
                    <Group gap="sm" mt="sm">
                      <Button
                        leftSection={<IconBellRinging size={16} />}
                        onClick={() => requestSubscribe()}
                        loading={pushLoading}
                        disabled={pushSubscribed || pushSubscribing}
                      >
                        {t('allowNotifications')}
                      </Button>
                      <Button
                        variant="light"
                        color="red"
                        leftSection={<IconBellOff size={16} />}
                        onClick={() => disablePush()}
                        loading={pushLoading}
                        disabled={!pushSubscribed}
                      >
                        {t('disablePushNotifications')}
                      </Button>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {t('allowNotificationsHint')}
                    </Text>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}

