'use client';

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
  IconSchool,
  IconUsers,
  IconClock,
  IconMessageCircle,
  IconAlertTriangle,
  IconTrendingUp,
  IconUserCheck,
  IconCalendarEvent,
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
import { useStudents } from '@/hooks/useStudents';
import { useStaff } from '@/hooks/useStaff';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { useStorageOverview } from '@/hooks/useStorage';
import { useLowStock } from '@/hooks/useInventory';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useConflicts } from '@/hooks/useTimetable';
import { useAttendanceSummary } from '@/hooks/useReports';
import { useUpcomingEventsConflictCount } from '@/hooks/api/useEvents';
import { DashboardStatCard } from './DashboardStatCard';
import type { User } from '@/types/auth';

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

interface AdminDashboardOverviewProps {
  user: User | undefined;
}

export function AdminDashboardOverview({ user }: AdminDashboardOverviewProps) {
  const t = useTranslations('dashboard');
  const colors = useThemeColors();
  const studentsQuery = useStudents({ limit: 1, page: 1 });
  const staffQuery = useStaff({ limit: 1, page: 1 });
  const leavePendingQuery = useLeaveRequests({ status: 'pending', limit: 1 });
  const earlyPendingQuery = useEarlyDepartures({ status: 'pending', limit: 1 });
  const storageQuery = useStorageOverview();
  const lowStockQuery = useLowStock();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: conflictsResponse } = useConflicts();
  const upcomingConflictQuery = useUpcomingEventsConflictCount();
  const upcomingEventsCount = upcomingConflictQuery.data?.totalUpcoming ?? 0;
  const eventsWithConflictsCount = upcomingConflictQuery.data?.eventsWithConflicts ?? 0;

  // Attendance summary: last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 6);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);
  const attendanceSummaryQuery = useAttendanceSummary(startStr, endStr);
  const attendanceOverall = attendanceSummaryQuery.data?.overall;

  const studentsTotal = studentsQuery.data?.meta?.total ?? 0;
  const staffTotal = staffQuery.data?.meta?.total ?? 0;
  const pendingLeaves = leavePendingQuery.data?.meta?.total ?? leavePendingQuery.data?.data?.length ?? 0;
  const pendingEarly = earlyPendingQuery.data?.meta?.total ?? earlyPendingQuery.data?.data?.length ?? 0;
  const pendingTotal = pendingLeaves + pendingEarly;
  const conflictCount = (conflictsResponse?.data ?? []).length;
  const storageOverview = storageQuery.data;
  const usedPct = storageOverview?.usedPercentage ?? 0;
  const usedGb = ((storageOverview?.usedBytes ?? 0) / (1024 * 1024 * 1024)).toFixed(1);
  const quotaGb = storageOverview?.quotaGb ?? 0;
  const lowStockItems = lowStockQuery.data ?? [];

  const loading =
    studentsQuery.isLoading ||
    staffQuery.isLoading ||
    leavePendingQuery.isLoading ||
    earlyPendingQuery.isLoading;

  const roleLabel = user?.roles?.[0]?.roleName
    ? formatRoleName(user.roles[0].roleName)
    : t('admin');

  const chartData = [
    { name: t('leaveRequests'), count: pendingLeaves },
    { name: t('earlyDepartures'), count: pendingEarly },
  ];

  return (
    <Stack gap="md">
      {/* Welcome card */}
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

      {/* Stat cards */}
      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={100} />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
          <DashboardStatCard
            id="dashboard-stat-students"
            title={t('students')}
            value={studentsTotal}
            icon={IconSchool}
            href="/students"
          />
          <DashboardStatCard
            id="dashboard-stat-staff"
            title={t('staff')}
            value={staffTotal}
            icon={IconUsers}
            href="/users"
          />
          <DashboardStatCard
            id="dashboard-stat-pending-approvals"
            title={t('pendingApprovals')}
            value={pendingTotal}
            icon={IconClock}
            href="/leaves"
          />
          <DashboardStatCard
            id="dashboard-stat-unread"
            title={t('unread')}
            value={unreadCount}
            icon={IconMessageCircle}
            href="/notifications"
          />
          <DashboardStatCard
            id="dashboard-stat-conflicts"
            title={t('conflicts')}
            value={conflictCount}
            icon={IconAlertTriangle}
            href="/conflict-management"
          />
        </SimpleGrid>
      )}

      <Grid>
        {/* Pending requests chart */}
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

        {/* Low stock alerts */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper
            component={Link}
            href="/inventory"
            id="dashboard-panel-low-stock"
            p="md"
            withBorder
            h="100%"
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Group gap="xs">
                <IconAlertTriangle size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('lowStockAlerts')}</Title>
              </Group>
              {lowStockQuery.isLoading ? (
                <Skeleton height={200} />
              ) : lowStockItems.length > 0 ? (
                <Stack gap="xs">
                  {lowStockItems.slice(0, 5).map((item) => {
                    const totalQty =
                      item.stock?.reduce((s, e) => s + (e?.quantity ?? 0), 0) ?? 0;
                    return (
                      <Card key={item.id} p="sm" withBorder>
                        <Text fw={500} size="sm">
                          {item.name}
                        </Text>
                        <Badge variant="light" color={colors.warning} size="sm" mt="xs">
                          {t('stock')}: {totalQty}
                        </Badge>
                      </Card>
                    );
                  })}
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" py="xl" size="sm">
                  {t('noLowStockAlerts')}
                </Text>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Upcoming events & conflicts */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            component={Link}
            href="/events"
            id="dashboard-panel-upcoming-events"
            p="md"
            withBorder
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Group gap="xs">
                <IconCalendarEvent size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('upcomingEventsAndConflicts')}</Title>
              </Group>
              {upcomingConflictQuery.isLoading ? (
                <Skeleton height={80} />
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('metric')}</Table.Th>
                      <Table.Th>{t('count')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>{t('upcomingEvents')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.primary}>
                          {upcomingEventsCount}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>{t('eventsWithConflicts')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={eventsWithConflictsCount > 0 ? colors.error : 'gray'}>
                          {eventsWithConflictsCount}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Storage usage */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            component={Link}
            href="/admin/storage"
            id="dashboard-panel-storage"
            p="md"
            withBorder
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Title order={3}>{t('storageUsage')}</Title>
              {storageQuery.isLoading ? (
                <Skeleton height={60} />
              ) : (
                <>
                  <Text size="sm" c="dimmed">
                    {usedGb} GB {t('of')} {quotaGb} GB {t('used')} ({Math.round(usedPct)}%)
                  </Text>
                  <Box
                    component="div"
                    style={{
                      height: 12,
                      borderRadius: 4,
                      backgroundColor: 'var(--mantine-color-gray-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="div"
                      style={{
                        width: `${Math.min(usedPct, 100)}%`,
                        height: '100%',
                        backgroundColor: usedPct > 90 ? colors.error : colors.primary,
                        transition: 'width 0.2s ease',
                      }}
                    />
                  </Box>
                </>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        {/* Attendance metrics */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            component={Link}
            href="/attendance"
            id="dashboard-panel-attendance"
            p="md"
            withBorder
            styles={linkPaperStyles}
          >
            <Stack gap="md">
              <Group gap="xs">
                <IconUserCheck size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('attendanceMetrics')}</Title>
              </Group>
              <Text size="xs" c="dimmed">
                {t('last7Days')}
              </Text>
              {attendanceSummaryQuery.isLoading ? (
                <Skeleton height={140} />
              ) : attendanceOverall ? (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('metric')}</Table.Th>
                      <Table.Th>{t('count')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>{t('present')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="green">
                          {attendanceOverall.totalPresent}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>{t('absent')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.error}>
                          {attendanceOverall.totalAbsent}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>{t('late')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.warning}>
                          {attendanceOverall.totalLate}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>{t('excused')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {attendanceOverall.totalExcused}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td>{t('average')}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.primary}>
                          {attendanceOverall.averageAttendance}%
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              ) : (
                <Text c="dimmed" size="sm">
                  {t('noAttendanceData')}
                </Text>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
