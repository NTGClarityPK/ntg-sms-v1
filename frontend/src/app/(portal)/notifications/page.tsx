'use client';

import { useMemo, useState } from 'react';
import {
  Group,
  Title,
  Stack,
  Paper,
  Text,
  Badge,
  Button,
  Table,
  Skeleton,
  Chip,
} from '@mantine/core';
import { IconBell, IconChecks } from '@tabler/icons-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/types/notifications';

export default function NotificationsPage() {
  const router = useRouter();
  const notifyColors = useThemeColors();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const { data: allNotificationsData, isLoading: isLoadingAll } = useNotifications({
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
        return notifyColors.success;
      case 'event':
      case 'event_created':
      case 'event_updated':
        return notifyColors.primary;
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
          <Text c="dimmed">No notifications found</Text>
        </Stack>
      );
    }

    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Body</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
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
                      Critical
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
                  {notification.isRead ? 'Read' : 'Unread'}
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
                    Mark Read
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Notifications</Title>
          {unreadCount > 0 && (
            <Button
              leftSection={<IconChecks size={18} />}
              onClick={() => markAllAsRead.mutate()}
              loading={markAllAsRead.isPending}
            >
              Mark All as Read
            </Button>
          )}
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
        <Paper withBorder p="md">
          {/* Multiselect filter chips (RMS New Order / Orders screen reference) */}
          <Paper p="sm" withBorder mb="md">
            <Group gap="xs" wrap="wrap" className="filter-chip-group">
              <Chip
                checked={selectedFilters.length === 0}
                onChange={() => setSelectedFilters([])}
                variant="filled"
              >
                All ({allNotifications.length})
              </Chip>
              <Chip.Group multiple value={selectedFilters} onChange={setSelectedFilters}>
                <Group gap="xs" wrap="wrap">
                  <Chip value="unread" variant="filled">
                    Unread ({unreadCount})
                  </Chip>
                  <Chip value="read" variant="filled">
                    Read ({readCount})
                  </Chip>
                  <Chip value="attendance" variant="filled">
                    Attendance ({attendanceCount})
                  </Chip>
                </Group>
              </Chip.Group>
            </Group>
          </Paper>

          {renderNotificationsTable(filteredNotifications, isLoadingAll)}
        </Paper>
      </div>
    </>
  );
}

