'use client';

/**
 * Assessment Statistics Page
 * Displays detailed statistics and analytics for an assessment (stat cards, ring progress, performance metrics, per-student status)
 */

import {
  Title,
  Paper,
  Stack,
  Text,
  Skeleton,
  Group,
  Button,
  SimpleGrid,
  RingProgress,
  Box,
  Table,
  ScrollArea,
  Badge,
} from '@mantine/core';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useAssessment,
  useAssessmentStatistics,
  useAssessmentStudentStatus,
  type AssessmentStudentStatus,
} from '@/hooks/api/useAssessments';
import { IconUsers, IconCheck, IconX, IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';

export default function AssessmentStatisticsPage() {
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const assessmentId = (params?.id as string) ?? undefined;

  const { data: assessmentData, isLoading: assessmentLoading } = useAssessment(assessmentId);
  const { data: statisticsData, isLoading: statsLoading } = useAssessmentStatistics(assessmentId);
  const { data: studentStatusData, isLoading: statusLoading } = useAssessmentStudentStatus(assessmentId);

  const assessment = assessmentData;
  const statistics = statisticsData;
  const studentStatuses: AssessmentStudentStatus[] = Array.isArray(studentStatusData)
    ? studentStatusData
    : [];

  if (assessmentLoading || statsLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Skeleton height={40} width="40%" />
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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={120} />
            ))}
          </SimpleGrid>
        </div>
      </>
    );
  }

  if (!assessment || !statistics) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('statisticsTitle')}</Title>
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
          <Paper p="xl" withBorder>
            <Text ta="center" c="dimmed">
              {t('assessmentOrStatsNotFound')}
            </Text>
          </Paper>
        </div>
      </>
    );
  }

  const statCards = [
    { title: t('totalStudents'), value: statistics.totalStudents, icon: IconUsers, color: 'blue' },
    { title: t('graded'), value: statistics.gradedCount, icon: IconCheck, color: 'green' },
    { title: t('pending'), value: statistics.ungradedCount, icon: IconClock, color: 'orange' },
    { title: t('absent'), value: statistics.absentCount, icon: IconX, color: 'red' },
  ];

  return (
    <>
      <div
        className="page-title-bar"
        style={{
          height: 'auto',
          minHeight: '80px',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-sm)',
          overflow: 'visible',
        }}
      >
        <Group justify="space-between" w="100%">
          <Stack gap={4}>
            <Title order={1}>
              {t('statisticsTitle')}: {assessment.title}
            </Title>
          </Stack>
          <Button variant="subtle" onClick={() => router.back()}>
            {tCommon('back')}
          </Button>
        </Group>
      </div>

      <div
        style={{
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          // Global styles force margin-top=0 after .page-title-bar, so use padding-top for extra clearance.
          paddingTop: 'calc(var(--mantine-spacing-sm) + 24px)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('statisticsSubtitle')}
          </Text>
          {/* Stat Cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            {statCards.map((stat) => (
              <Paper key={stat.title} p="md" withBorder>
                <Group>
                  <Box>
                    <stat.icon size={24} color={`var(--mantine-color-${stat.color}-6)`} />
                  </Box>
                  <Stack gap={0} flex={1}>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      {stat.title}
                    </Text>
                    <Text size="xl" fw={700}>
                      {stat.value}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ))}
          </SimpleGrid>

          {/* Progress Rings (graphs) */}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Paper p="md" withBorder>
              <Stack align="center" gap="md">
                <Text fw={500}>{t('submissionRate')}</Text>
                <RingProgress
                  size={200}
                  thickness={20}
                  sections={[{ value: statistics.submissionRate, color: 'blue' }]}
                  label={
                    <Text ta="center" fw={700} size="xl">
                      {typeof statistics.submissionRate === 'number'
                        ? `${statistics.submissionRate.toFixed(1)}%`
                        : '—'}
                    </Text>
                  }
                />
                <Text size="sm" c="dimmed">
                  {t('studentsCount', {
                    graded: statistics.gradedCount,
                    total: statistics.totalStudents,
                  })}
                </Text>
              </Stack>
            </Paper>

            <Paper p="md" withBorder>
              <Stack align="center" gap="md">
                <Text fw={500}>{t('completionRate')}</Text>
                <RingProgress
                  size={200}
                  thickness={20}
                  sections={[{ value: statistics.completionRate, color: 'green' }]}
                  label={
                    <Text ta="center" fw={700} size="xl">
                      {typeof statistics.completionRate === 'number'
                        ? `${statistics.completionRate.toFixed(1)}%`
                        : '—'}
                    </Text>
                  }
                />
                <Text size="sm" c="dimmed">
                  {t('excludingAbsentExcused')}
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* Performance Metrics */}
          {(statistics.averageMarks !== undefined ||
            statistics.highestMarks !== undefined ||
            statistics.lowestMarks !== undefined) && (
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Text fw={500} size="lg">
                  {t('performanceMetrics')}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      {t('averageMarks')}
                    </Text>
                    <Text size="xl" fw={700}>
                      {statistics.averageMarks !== undefined && statistics.averageMarks !== null
                        ? `${statistics.averageMarks.toFixed(2)} / ${assessment.totalMarks}`
                        : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      {t('highestMarks')}
                    </Text>
                    <Text size="xl" fw={700} c="green">
                      {statistics.highestMarks != null
                        ? statistics.highestMarks.toFixed(2)
                        : '—'}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      {t('lowestMarks')}
                    </Text>
                    <Text size="xl" fw={700} c="red">
                      {statistics.lowestMarks != null ? statistics.lowestMarks.toFixed(2) : '—'}
                    </Text>
                  </Box>
                </SimpleGrid>
              </Stack>
            </Paper>
          )}

          {/* Assessment Status - per student */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Text fw={500} size="lg">
                {t('assessmentStatus')}
              </Text>
              <Text size="sm" c="dimmed">
                {t('showingStatusForEnrolled')}
              </Text>
              {statusLoading ? (
                <Stack gap="xs">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} height={40} />
                  ))}
                </Stack>
              ) : studentStatuses.length > 0 ? (
                <ScrollArea>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('student')}</Table.Th>
                        <Table.Th>{t('status')}</Table.Th>
                        <Table.Th>{t('read')}</Table.Th>
                        <Table.Th>{t('lastUpdated')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {studentStatuses.map((s) => (
                        <Table.Tr key={s.studentId}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text size="sm" fw={500}>
                                {s.studentName ?? t('student')}
                              </Text>
                              {s.studentStudentId && (
                                <Text size="xs" c="dimmed">
                                  ID: {s.studentStudentId}
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            {s.status === 'submitted' ? (
                              <Badge color="green">{t('submitted')}</Badge>
                            ) : s.status === 'in_progress' ? (
                              <Badge color="yellow">{t('inProgress')}</Badge>
                            ) : (
                              <Badge color="gray">{t('notStarted')}</Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {s.isRead ? (
                              <Badge color="blue" variant="light">
                                {t('read')}
                              </Badge>
                            ) : (
                              <Badge color="gray" variant="light">
                                {t('unread')}
                              </Badge>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {s.updatedAt
                              ? dayjs(s.updatedAt).format('DD MMM YYYY HH:mm')
                              : '—'}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              ) : (
                <Text size="sm" c="dimmed">
                  {t('noStudentsMarkedRead')}
                </Text>
              )}
            </Stack>
          </Paper>
        </Stack>
      </div>
    </>
  );
}
