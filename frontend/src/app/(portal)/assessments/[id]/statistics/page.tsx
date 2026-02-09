'use client';

/**
 * Assessment Statistics Page
 * Displays detailed statistics and analytics for an assessment
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
import { useAssessment, useAssessmentStatistics, useAssessmentStudentStatus, AssessmentStudentStatus } from '@/hooks/api/useAssessments';
import { IconUsers, IconCheck, IconX, IconClock } from '@tabler/icons-react';
import dayjs from 'dayjs';

export default function AssessmentStatisticsPage() {
  const router = useRouter();
  const params = useParams();
  const assessmentId = params.id as string;
  const { data: assessmentData, isLoading: assessmentLoading } = useAssessment(assessmentId);
  const { data: statisticsData, isLoading: statsLoading } = useAssessmentStatistics(assessmentId);
  const { data: studentStatusData, isLoading: statusLoading } = useAssessmentStudentStatus(assessmentId);
  const assessment = assessmentData; // Hook already returns response.data
  const statistics = statisticsData; // Hook already returns response.data
  const studentStatuses: AssessmentStudentStatus[] = Array.isArray(studentStatusData) ? studentStatusData : [];

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
          <Title order={1}>Statistics</Title>
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
              Assessment or statistics not found.
            </Text>
          </Paper>
        </div>
      </>
    );
  }

  const statCards = [
    {
      title: 'Total Students',
      value: statistics.totalStudents,
      icon: IconUsers,
      color: 'blue',
    },
    {
      title: 'Graded',
      value: statistics.gradedCount,
      icon: IconCheck,
      color: 'green',
    },
    {
      title: 'Pending',
      value: statistics.ungradedCount,
      icon: IconClock,
      color: 'orange',
    },
    {
      title: 'Absent',
      value: statistics.absentCount,
      icon: IconX,
      color: 'red',
    },
  ];

  return (
    <>
      <div className="page-title-bar" style={{ height: 'auto', minHeight: '80px', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-sm)', overflow: 'visible' }}>
        <Group justify="space-between" w="100%">
          <Stack gap={4}>
            <Title order={1}>Statistics: {assessment.title}</Title>
            <Text size="sm" c="dimmed">
              Submission and grading progress for this assessment
            </Text>
          </Stack>
          <Button variant="subtle" onClick={() => router.back()}>
            Back
          </Button>
        </Group>
      </div>

      <div
        style={{
          marginTop: '100px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">

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

        {/* Progress Rings */}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Paper p="md" withBorder>
            <Stack align="center" gap="md">
              <Text fw={500}>Submission Rate</Text>
              <RingProgress
                size={200}
                thickness={20}
                sections={[{ value: statistics.submissionRate, color: 'blue' }]}
                label={
                  <Text ta="center" fw={700} size="xl">
                    {statistics.submissionRate.toFixed(1)}%
                  </Text>
                }
              />
              <Text size="sm" c="dimmed">
                {statistics.gradedCount - statistics.absentCount - statistics.excusedCount} of {statistics.totalStudents} students
              </Text>
            </Stack>
          </Paper>

          <Paper p="md" withBorder>
            <Stack align="center" gap="md">
              <Text fw={500}>Completion Rate</Text>
              <RingProgress
                size={200}
                thickness={20}
                sections={[{ value: statistics.completionRate, color: 'green' }]}
                label={
                  <Text ta="center" fw={700} size="xl">
                    {statistics.completionRate.toFixed(1)}%
                  </Text>
                }
              />
              <Text size="sm" c="dimmed">
                Excluding absent and excused students
              </Text>
            </Stack>
          </Paper>
        </SimpleGrid>

        {/* Performance Metrics */}
        {statistics.averageMarks !== undefined && (
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Text fw={500} size="lg">
                Performance Metrics
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Average Marks
                  </Text>
                  <Text size="xl" fw={700}>
                    {statistics.averageMarks.toFixed(2)} / {assessment.totalMarks}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Highest Marks
                  </Text>
                  <Text size="xl" fw={700} c="green">
                    {statistics.highestMarks?.toFixed(2) ?? '—'}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Lowest Marks
                  </Text>
                  <Text size="xl" fw={700} c="red">
                    {statistics.lowestMarks?.toFixed(2) ?? '—'}
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
              Assessment Status
            </Text>
            <Text size="sm" c="dimmed">
              Showing status for all enrolled students who have interacted with this assessment.
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
                      <Table.Th>Student</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Read</Table.Th>
                      <Table.Th>Last Updated</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {studentStatuses.map((s) => (
                      <Table.Tr key={s.studentId}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>
                              {s.studentName || 'Student'}
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
                            <Badge color="green">Submitted</Badge>
                          ) : s.status === 'in_progress' ? (
                            <Badge color="yellow">In progress</Badge>
                          ) : (
                            <Badge color="gray">Not started</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {s.isRead ? (
                            <Badge color="blue" variant="light">
                              Read
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light">
                              Unread
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
                No students have marked this assessment as read or submitted yet.
              </Text>
            )}
          </Stack>
        </Paper>

        </Stack>
      </div>
    </>
  );
}

