'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Stack,
  SimpleGrid,
  Paper,
  Text,
  Title,
  Grid,
  Skeleton,
  Badge,
  Table,
  Box,
  Group,
  Card,
} from '@mantine/core';
import Link from 'next/link';
import {
  IconUsers,
  IconClock,
  IconMessageCircle,
  IconCalendarEvent,
  IconTrendingUp,
  IconChevronRight,
} from '@tabler/icons-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useMyEvents } from '@/hooks/api/useEvents';
import { apiClient } from '@/lib/api-client';
import { DashboardStatCard } from './DashboardStatCard';
import type { User } from '@/types/auth';
import type { ParentLinkedChild } from '@/types/parent-children';

const linkPaperStyles = {
  root: {
    textDecoration: 'none' as const,
    color: 'inherit' as const,
    display: 'block' as const,
    transition: 'background-color 150ms ease',
    '&:hover': {
      backgroundColor: 'var(--mantine-color-default-hover)',
    },
  },
};

function formatRoleName(roleName: string): string {
  return roleName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function relationshipLabel(
  t: ReturnType<typeof useTranslations<'dashboard'>>,
  relationship: ParentLinkedChild['relationship'],
): string {
  if (relationship === 'father') return t('relationshipFather');
  if (relationship === 'mother') return t('relationshipMother');
  return t('relationshipGuardian');
}

function childStatusBadge(
  t: ReturnType<typeof useTranslations<'dashboard'>>,
  child: ParentLinkedChild,
): { label: string; color: string } {
  if (child.isActive === false) {
    return { label: t('childStatusInactive'), color: 'gray' };
  }
  if (child.accountStatus === 'pending_verification') {
    return { label: t('childStatusPending'), color: 'yellow' };
  }
  if (child.accountStatus === 'link_expired') {
    return { label: t('childStatusLinkExpired'), color: 'orange' };
  }
  return { label: t('childStatusActive'), color: 'green' };
}

interface ParentDashboardOverviewProps {
  user: User | undefined;
}

export function ParentDashboardOverview({ user }: ParentDashboardOverviewProps) {
  const t = useTranslations('dashboard');
  const colors = useThemeColors();
  const userId = user?.id;

  const childrenQuery = useQuery({
    queryKey: ['my-children', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.get<ParentLinkedChild[]>(
        `/api/v1/parents/${userId}/children`,
      );
      return response.data || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const children = Array.isArray(childrenQuery.data) ? childrenQuery.data : [];
  const childrenCount = children.length;

  const leavePendingQuery = useLeaveRequests({ status: 'pending', page: 1, limit: 1 });
  const earlyPendingQuery = useEarlyDepartures({ status: 'pending', page: 1, limit: 1 });
  const pendingLeaves = leavePendingQuery.data?.meta?.total ?? leavePendingQuery.data?.data?.length ?? 0;
  const pendingEarly = earlyPendingQuery.data?.meta?.total ?? earlyPendingQuery.data?.data?.length ?? 0;
  const pendingTotal = pendingLeaves + pendingEarly;
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: eventsResponse } = useMyEvents();
  const events = eventsResponse?.data ?? [];
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter((e) => e.startDate >= today).slice(0, 5);

  const loading =
    leavePendingQuery.isLoading || earlyPendingQuery.isLoading;
  const childrenLoading = childrenQuery.isLoading;

  const roleLabel = user?.roles?.[0]?.roleName
    ? formatRoleName(user.roles[0].roleName)
    : t('parent');

  const chartData = [
    { name: t('leaveRequests'), count: pendingLeaves },
    { name: t('earlyDepartures'), count: pendingEarly },
  ];

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Text size="lg" fw={600}>
            {t('welcome')}, {user?.fullName ?? user?.email ?? t('user')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('role')}: {roleLabel}
          </Text>
        </Stack>
      </Paper>

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={100} />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <DashboardStatCard
            id="dashboard-stat-children"
            title={t('children')}
            value={childrenCount}
            icon={IconUsers}
            href="/my-children"
          />
          <DashboardStatCard
            id="dashboard-stat-pending-tasks"
            title={t('pendingTasks')}
            value={pendingTotal}
            icon={IconClock}
            href="/leaves"
          />
          <DashboardStatCard
            id="dashboard-stat-upcoming-events"
            title={t('upcomingEventsList')}
            value={upcomingEvents.length}
            icon={IconCalendarEvent}
            href="/my-events"
          />
          <DashboardStatCard
            id="dashboard-stat-unread"
            title={t('unread')}
            value={unreadCount}
            icon={IconMessageCircle}
            href="/notifications"
          />
        </SimpleGrid>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper
            component={Link}
            href="/leaves"
            id="dashboard-panel-pending-requests"
            p="md"
            withBorder
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Group gap="xs">
                <IconTrendingUp size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('pendingRequests')}</Title>
              </Group>
              {loading ? (
                <Skeleton height={280} />
              ) : (
                <Box h={280}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip cursor={false} contentStyle={{ backgroundColor: 'var(--mantine-color-dark-7)', border: '1px solid var(--mantine-color-dark-4)', borderRadius: 8 }} labelStyle={{ color: '#ffffff' }} itemStyle={{ color: '#ffffff' }} />
                      <Bar dataKey="count" name={t('count')} fill={colors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" withBorder h="100%">
            <Stack gap="md">
              <Group gap="xs">
                <IconClock size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('tasksSummary')}</Title>
              </Group>
              {loading ? (
                <Skeleton height={120} />
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('type')}</Table.Th>
                      <Table.Th>{t('pending')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>{t('leaveRequests')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.info}>
                          {pendingLeaves}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>{t('earlyDepartures')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.warning}>
                          {pendingEarly}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            component={Link}
            href="/my-events"
            id="dashboard-panel-upcoming-events-list"
            p="md"
            withBorder
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Group gap="xs">
                <IconCalendarEvent size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('upcomingEvents')}</Title>
              </Group>
              {upcomingEvents.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('noUpcomingEvents')}
                </Text>
              ) : (
                <Stack gap="xs">
                  {upcomingEvents.map((event) => (
                    <Card key={event.id} p="sm" withBorder>
                      <Text fw={500} size="sm">
                        {event.title}
                      </Text>
                      <Badge variant="light" size="sm" mt="xs">
                        {event.startDate}
                        {event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}
                      </Badge>
                      {event.studentNames && event.studentNames.length > 0 && (
                        <Text size="xs" c="dimmed" mt="xs">
                          {event.studentNames.join(', ')}
                        </Text>
                      )}
                    </Card>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            component={Link}
            href="/my-children"
            id="dashboard-panel-my-children"
            p="md"
            withBorder
            h="100%"
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <IconUsers size={24} style={{ color: colors.primary }} />
                  <Title order={3}>{t('myChildrenPanelTitle')}</Title>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {t('myChildrenPanelViewAll')}
                  </Text>
                  <IconChevronRight size={16} style={{ color: colors.primary }} />
                </Group>
              </Group>

              {childrenLoading ? (
                <Stack gap="xs">
                  <Skeleton height={72} radius="sm" />
                  <Skeleton height={72} radius="sm" />
                </Stack>
              ) : children.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('noChildrenLinked')}
                </Text>
              ) : (
                <Stack gap="xs">
                  {children.slice(0, 5).map((child) => {
                    const status = childStatusBadge(t, child);
                    return (
                      <Card key={child.id} p="sm" withBorder>
                        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={600} size="sm" lineClamp={1}>
                              {child.studentName || t('unnamedStudent')}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {child.classSectionLabel
                                ? child.classSectionLabel
                                : `${t('studentIdLabel')}: ${child.studentStudentId || child.studentId}`}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {relationshipLabel(t, child.relationship)}
                              {child.isPrimary ? ` · ${t('primaryContact')}` : ''}
                            </Text>
                          </Stack>
                          <Badge variant="light" color={status.color} style={{ flexShrink: 0 }}>
                            {status.label}
                          </Badge>
                        </Group>
                      </Card>
                    );
                  })}
                  {children.length > 5 ? (
                    <Text size="xs" c="dimmed">
                      {t('myChildrenPanelMore', { count: children.length - 5 })}
                    </Text>
                  ) : null}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
