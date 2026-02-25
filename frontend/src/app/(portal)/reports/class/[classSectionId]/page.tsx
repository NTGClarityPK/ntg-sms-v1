'use client';

import { useParams } from 'next/navigation';
import {
  Group,
  Title,
  Stack,
  Table,
  Paper,
  Text,
  Skeleton,
  Button,
  Badge,
} from '@mantine/core';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { useClassReport } from '@/hooks/useReports';
import { ExportButton } from '@/components/features/reports/ExportButton';

export default function ClassReportByIdPage() {
  const params = useParams();
  const classSectionId = typeof params.classSectionId === 'string' ? params.classSectionId : null;

  const reportQuery = useClassReport(classSectionId);
  const report = reportQuery.data;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Class report</Title>
          <Group>
            {classSectionId && (
              <ExportButton variant="class" classSectionId={classSectionId} />
            )}
            <Button
              id="reports-class-back"
              component={Link}
              href="/reports/class"
              leftSection={<IconArrowLeft size={16} />}
              variant="subtle"
            >
              Back
            </Button>
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
        <Stack gap="md">
          {reportQuery.isLoading ? (
            <Skeleton height={200} radius="sm" />
          ) : !report ? (
            <Text c="dimmed">No report data.</Text>
          ) : (
            <>
              <Text fw={600}>
                {report.className} {report.sectionName}
              </Text>
              <Paper withBorder p="md">
                <Text fw={600} mb="md">Attendance</Text>
                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Student</Table.Th>
                      <Table.Th>Present</Table.Th>
                      <Table.Th>Total days</Table.Th>
                      <Table.Th>Attendance %</Table.Th>
                      <Table.Th>Average Grade %</Table.Th>
                      <Table.Th>Assignment Viewing</Table.Th>
                      <Table.Th>Assignment Submission</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {report.students.map((s) => (
                      <Table.Tr key={s.studentId}>
                        <Table.Td>{s.studentName}</Table.Td>
                        <Table.Td>{s.presentDays}</Table.Td>
                        <Table.Td>{s.totalDays}</Table.Td>
                        <Table.Td>{s.attendancePercentage}%</Table.Td>
                        <Table.Td>
                          {s.averagePercentage !== undefined ? (
                            <Badge
                              color={
                                s.averagePercentage >= 70
                                  ? 'green'
                                  : s.averagePercentage >= 50
                                    ? 'yellow'
                                    : 'red'
                              }
                              variant="light"
                              size="sm"
                            >
                              {s.averagePercentage}%
                            </Badge>
                          ) : (
                            <Text c="dimmed">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {s.assignmentStatistics ? (
                            <Text size="sm">
                              {s.assignmentStatistics.viewedAssignments}/{s.assignmentStatistics.totalAssignments} ({s.assignmentStatistics.viewingRate}%)
                            </Text>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {s.assignmentStatistics ? (
                            <Text size="sm">
                              {s.assignmentStatistics.submittedAssignments}/{s.assignmentStatistics.totalAssignments} ({s.assignmentStatistics.submissionRate}%)
                            </Text>
                          ) : (
                            <Text c="dimmed" size="sm">—</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}
        </Stack>
      </div>
    </>
  );
}
