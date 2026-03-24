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
import {
  IconSchool,
  IconClipboardList,
  IconCalendar,
  IconMessageCircle,
  IconTrendingUp,
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
import { useMyStaff } from '@/hooks/useStaff';
import { useClassSections } from '@/hooks/useClassSections';
import { useAssessments } from '@/hooks/api/useAssessments';
import { useMyTimetable } from '@/hooks/useTimetable';
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

interface TeacherDashboardOverviewProps {
  user: User | undefined;
}

export function TeacherDashboardOverview({ user }: TeacherDashboardOverviewProps) {
  const t = useTranslations('dashboard');
  const colors = useThemeColors();
  const { data: myStaffData } = useMyStaff();
  const staffId = myStaffData?.data?.id;
  const { data: classSectionsData } = useClassSections({
    isActive: true,
    classTeacherId: staffId,
  });
  const classSections = classSectionsData?.data ?? [];
  const assessmentsQuery = useAssessments({ limit: 1, page: 1 });
  const timetableQuery = useMyTimetable();
  const { data: unreadCount = 0 } = useUnreadCount();
  const { data: eventsResponse } = useMyEvents();

  const myClassesCount = classSections.length;
  const pendingGradingTotal = assessmentsQuery.data?.meta?.total ?? 0;
  const timetable = timetableQuery.data?.data;
  const todayDayOfWeek = new Date().getDay();
  const todaySlots = (timetable?.slots ?? []).filter((s) => s.dayOfWeek === todayDayOfWeek);
  const todaySlotsCount = todaySlots.length;
  const events = eventsResponse?.data ?? [];
  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter((e) => e.startDate >= today).slice(0, 5);

  const loading =
    assessmentsQuery.isLoading || timetableQuery.isLoading;

  const roleLabel = user?.roles?.[0]?.roleName
    ? formatRoleName(user.roles[0].roleName)
    : t('teacher');

  const firstClass =
    classSections.length > 0 ? classSections[0] : undefined;
  const classDescriptor = firstClass
    ? `${firstClass.className || firstClass.classDisplayName || ''} ${firstClass.sectionName || ''}`.trim()
    : '';

  const chartData = [
    { name: t('assessment'), count: pendingGradingTotal },
    { name: t('todayClasses'), count: todaySlotsCount },
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
          {classDescriptor && (
            <Text size="sm" c="dimmed">
              {t('class')}: {classDescriptor}
            </Text>
          )}
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
            title={t('myClasses')}
            value={myClassesCount}
            icon={IconSchool}
          />
          <DashboardStatCard
            title={t('pendingGrading')}
            value={pendingGradingTotal}
            icon={IconClipboardList}
          />
          <DashboardStatCard
            title={t('todaySlots')}
            value={todaySlotsCount}
            icon={IconCalendar}
          />
          <DashboardStatCard
            title={t('unread')}
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
                <Title order={3}>{t('workloadOverview')}</Title>
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
                <IconCalendar size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('todaySchedule')}</Title>
              </Group>
              {timetableQuery.isLoading ? (
                <Skeleton height={200} />
              ) : todaySlots.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('noClassesScheduledToday')}
                </Text>
              ) : (
                <Stack gap="xs">
                  {todaySlots.slice(0, 6).map((slot) => (
                    <Card key={slot.id} p="sm" withBorder>
                      <Text fw={500} size="sm">
                        {slot.startTime}–{slot.endTime}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {slot.subjectName ?? t('period')}
                        {slot.className || slot.sectionName
                          ? ` · ${[slot.className, slot.sectionName].filter(Boolean).join(' ')}`
                          : ''}
                      </Text>
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
                <IconCalendarEvent size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('upcomingEvents')}</Title>
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
                <IconClipboardList size={24} style={{ color: colors.primary }} />
                <Title order={3}>Pending grading</Title>
              </Group>
              {assessmentsQuery.isLoading ? (
                <Skeleton height={80} />
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Metric</Table.Th>
                      <Table.Th>Count</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td>Assessments in system</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={colors.primary}>
                          {pendingGradingTotal}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
