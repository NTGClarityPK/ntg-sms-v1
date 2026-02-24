'use client';

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
import {
  IconUsers,
  IconClock,
  IconMessageCircle,
  IconCalendarEvent,
  IconTrendingUp,
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
import { useParentAssociations } from '@/hooks/useParentAssociations';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useMyEvents } from '@/hooks/api/useEvents';
import { DashboardStatCard } from './DashboardStatCard';
import type { User } from '@/types/auth';

function formatRoleName(roleName: string): string {
  return roleName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

interface ParentDashboardOverviewProps {
  user: User | undefined;
}

export function ParentDashboardOverview({ user }: ParentDashboardOverviewProps) {
  const colors = useThemeColors();
  const { data: associationsResponse } = useParentAssociations({
    parentId: user?.id,
    limit: 100,
  });
  const associations = associationsResponse?.data ?? [];
  const childrenCount = new Set(associations.map((a) => a.studentId)).size;
  const leavePendingQuery = useLeaveRequests({ status: 'pending', limit: 1 });
  const earlyPendingQuery = useEarlyDepartures({ status: 'pending', limit: 1 });
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

  const roleLabel = user?.roles?.[0]?.roleName
    ? formatRoleName(user.roles[0].roleName)
    : 'Parent';

  const chartData = [
    { name: 'Leave requests', count: pendingLeaves },
    { name: 'Early departures', count: pendingEarly },
  ];

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Stack gap="xs">
          <Text size="lg" fw={600}>
            Welcome, {user?.fullName ?? user?.email ?? 'User'}
          </Text>
          <Text size="sm" c="dimmed">
            Role: {roleLabel}
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
            title="Children"
            value={childrenCount}
            icon={IconUsers}
          />
          <DashboardStatCard
            title="Pending tasks"
            value={pendingTotal}
            icon={IconClock}
          />
          <DashboardStatCard
            title="Upcoming events"
            value={upcomingEvents.length}
            icon={IconCalendarEvent}
          />
          <DashboardStatCard
            title="Unread"
            value={unreadCount}
            icon={IconMessageCircle}
          />
        </SimpleGrid>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconTrendingUp size={24} style={{ color: colors.primary }} />
                <Title order={3}>Pending requests</Title>
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
                      <Tooltip />
                      <Bar dataKey="count" name="Count" fill={colors.primary} radius={[4, 4, 0, 0]} />
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
                <Title order={3}>Tasks summary</Title>
              </Group>
              {loading ? (
                <Skeleton height={120} />
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Pending</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>Leave requests</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.info}>
                          {pendingLeaves}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>Early departures</Table.Td>
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
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconCalendarEvent size={24} style={{ color: colors.primary }} />
                <Title order={3}>Upcoming events</Title>
              </Group>
              {upcomingEvents.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No upcoming events
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
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconUsers size={24} style={{ color: colors.primary }} />
                <Title order={3}>My children</Title>
              </Group>
              {associations.length === 0 ? (
                <Text c="dimmed" size="sm">
                  No children linked
                </Text>
              ) : (
                <Stack gap="xs">
                  {[...new Map(associations.map((a) => [a.studentId, a])).values()]
                    .slice(0, 5)
                    .map((a) => (
                      <Card key={a.id} p="sm" withBorder>
                        <Text fw={500} size="sm">
                          {a.studentName ?? a.studentStudentId ?? 'Student'}
                        </Text>
                        <Badge variant="light" size="xs" mt="xs">
                          {a.relationship}
                        </Badge>
                      </Card>
                    ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
