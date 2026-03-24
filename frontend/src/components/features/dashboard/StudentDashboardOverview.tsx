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
  IconClipboardList,
  IconReport,
  IconCalendar,
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
import { useMyStudent } from '@/hooks/useStudents';
import { useMyAssessments } from '@/hooks/api/useMyAssessments';
import { useStudentGrades } from '@/hooks/api/useGrades';
import { useStudentTimetable } from '@/hooks/useTimetable';
import { DashboardStatCard } from './DashboardStatCard';
import type { User } from '@/types/auth';
import type { StudentGrade } from '@/types/assessment';

function formatRoleName(roleName: string): string {
  return roleName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

interface StudentDashboardOverviewProps {
  user: User | undefined;
}

export function StudentDashboardOverview({ user }: StudentDashboardOverviewProps) {
  const t = useTranslations('dashboard');
  const colors = useThemeColors();
  const { data: myStudentData } = useMyStudent();
  const studentId = myStudentData?.data?.id ?? undefined;
  const { data: myAssessments = [], isLoading: assessmentsLoading } = useMyAssessments();
  const { data: gradesData, isLoading: gradesLoading } = useStudentGrades(studentId);
  const { data: timetableResponse, isLoading: timetableLoading } = useStudentTimetable(
    studentId ?? null,
  );

  const grades: StudentGrade[] = Array.isArray(gradesData)
    ? gradesData
    : (gradesData as { data?: StudentGrade[] } | undefined)?.data ?? [];
  const timetable = timetableResponse?.data;
  const todayDayOfWeek = new Date().getDay();
  const todaySlots = (timetable?.slots ?? []).filter((s) => s.dayOfWeek === todayDayOfWeek);
  const today = new Date().toISOString().split('T')[0];
  const upcomingAssessments = myAssessments.filter((a) => {
    const due = a.assessment?.dueDate;
    return due && due >= today;
  }).slice(0, 5);

  const loading = assessmentsLoading || gradesLoading || timetableLoading;

  const roleLabel = user?.roles?.[0]?.roleName
    ? formatRoleName(user.roles[0].roleName)
    : t('student');

  const chartData = [
    { name: t('upcomingAssessments'), count: upcomingAssessments.length },
    { name: t('todayClasses'), count: todaySlots.length },
    { name: t('gradesRecorded'), count: grades.length },
  ];

  if (!studentId) {
    return (
      <Stack gap="md">
        <Paper p="md" withBorder>
          <Text size="lg" fw={600}>
            {t('welcome')}, {user?.fullName ?? user?.email ?? t('user')}
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            {t('selectStudentProfile')}
          </Text>
        </Paper>
      </Stack>
    );
  }

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
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={100} />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          <DashboardStatCard
            title={t('upcomingAssessments')}
            value={upcomingAssessments.length}
            icon={IconClipboardList}
          />
          <DashboardStatCard
            title={t('gradesRecorded')}
            value={grades.length}
            icon={IconReport}
          />
          <DashboardStatCard
            title={t('todayClasses')}
            value={todaySlots.length}
            icon={IconCalendar}
          />
        </SimpleGrid>
      )}

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconTrendingUp size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('overview')}</Title>
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
              {timetableLoading ? (
                <Skeleton height={200} />
              ) : todaySlots.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('noClassesToday')}
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
                <IconClipboardList size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('upcomingAssessments')}</Title>
              </Group>
              {upcomingAssessments.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('noUpcomingAssessments')}
                </Text>
              ) : (
                <Stack gap="xs">
                  {upcomingAssessments.map((a) => (
                    <Card key={a.assessment.id} p="sm" withBorder>
                      <Text fw={500} size="sm">
                        {a.assessment.title}
                      </Text>
                      <Badge variant="light" size="sm" mt="xs">
                        {t('due')}: {a.assessment.dueDate ?? '—'}
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
                <IconReport size={24} style={{ color: colors.primary }} />
                <Title order={3}>{t('recentGrades')}</Title>
              </Group>
              {gradesLoading ? (
                <Skeleton height={80} />
              ) : grades.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {t('noGradesRecordedYet')}
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('assessment')}</Table.Th>
                      <Table.Th>{t('marks')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {grades.slice(0, 5).map((g) => (
                      <Table.Tr key={g.id}>
                        <Table.Td>
                          <Text size="sm">{t('assessment')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={colors.primary}>
                            {g.marksObtained} {t('marks')}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
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
