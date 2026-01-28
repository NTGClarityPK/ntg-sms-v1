'use client';

import { useState } from 'react';
import {
  Group,
  Title,
  Tabs,
  Stack,
  Paper,
  Text,
  Badge,
  Button,
  Table,
  Loader,
} from '@mantine/core';
import { IconBell, IconChecks } from '@tabler/icons-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/hooks/useNotifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/types/notifications';

export default function NotificationsPage() {
  const router = useRouter();
  const notifyColors = useThemeColors();
  const [activeTab, setActiveTab] = useState<string | null>('all');
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const { data: allNotificationsData, isLoading: isLoadingAll } = useNotifications({
    limit: 100,
  });

  const allNotifications = allNotificationsData?.data || [];
  const unreadNotifications = allNotifications.filter((n) => !n.isRead);
  const readNotifications = allNotifications.filter((n) => n.isRead);
  const attendanceNotifications = allNotifications.filter((n) => n.type === 'attendance');

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
        <Stack align="center" gap="md" py="xl">
          <Loader />
          <Text c="dimmed">Loading notifications...</Text>
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
                <Badge variant="light" color={getTypeColor(notification.type)}>
                  {notification.type}
                </Badge>
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
          {unreadNotifications.length > 0 && (
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
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="all">
                All ({allNotifications.length})
              </Tabs.Tab>
              <Tabs.Tab value="unread">
                Unread ({unreadNotifications.length})
              </Tabs.Tab>
              <Tabs.Tab value="read">
                Read ({readNotifications.length})
              </Tabs.Tab>
              <Tabs.Tab value="attendance">
                Attendance ({attendanceNotifications.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="all" pt="md">
              {renderNotificationsTable(allNotifications, isLoadingAll)}
            </Tabs.Panel>

            <Tabs.Panel value="unread" pt="md">
              {renderNotificationsTable(unreadNotifications, isLoadingAll)}
            </Tabs.Panel>

            <Tabs.Panel value="read" pt="md">
              {renderNotificationsTable(readNotifications, isLoadingAll)}
            </Tabs.Panel>

            <Tabs.Panel value="attendance" pt="md">
              {renderNotificationsTable(attendanceNotifications, isLoadingAll)}
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </div>
    </>
  );
}

