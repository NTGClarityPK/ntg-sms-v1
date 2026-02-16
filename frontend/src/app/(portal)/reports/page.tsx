'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Group,
  Title,
  Tabs,
  Paper,
  Stack,
  Text,
  Chip,
  Select,
  Box,
  Alert,
  Table,
  Badge,
  Skeleton,
} from '@mantine/core';
import { IconUser, IconUsersGroup, IconChartBar } from '@tabler/icons-react';
import { useClassSections } from '@/hooks/useClassSections';
import { useStudents, useMyStudent } from '@/hooks/useStudents';
import { useAuth } from '@/hooks/useAuth';
import {
  useStudentReport,
  useClassReport,
  usePublicClassCounts,
} from '@/hooks/useReports';
import { StudentReportCard } from '@/components/features/reports/StudentReportCard';
import { ReportPeriodSelector } from '@/components/features/reports/ReportPeriodSelector';
import { ExportButton } from '@/components/features/reports/ExportButton';
import type { ClassSection } from '@/types/class-sections';
import type { Student } from '@/types/students';
import { ReportPeriodType } from '@/types/reports';

function getPeriodDates(period: string): { periodType: ReportPeriodType; startDate: string | null; endDate: string | null } {
  const now = new Date();
  if (period === 'year') {
    return { periodType: ReportPeriodType.YEAR, startDate: null, endDate: null };
  }
  if (period === 'week') {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() + mondayOffset);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);
    return {
      periodType: ReportPeriodType.WEEK,
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
    };
  }
  if (period === 'month') {
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      periodType: ReportPeriodType.MONTH,
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
    };
  }
  return { periodType: ReportPeriodType.YEAR, startDate: null, endDate: null };
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('student');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [periodChip, setPeriodChip] = useState<string>('year');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<ReportPeriodType | null>(ReportPeriodType.YEAR);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const { user } = useAuth();
  const isStudent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'student') ?? false;
  const myStudentQuery = useMyStudent();
  const studentsQuery = useStudents({ limit: 100 });
  const classSectionsQuery = useClassSections({ limit: 100 });

  const periodParams = useMemo(() => {
    if (periodType === ReportPeriodType.CUSTOM) {
      return { periodType: ReportPeriodType.CUSTOM, startDate, endDate };
    }
    return getPeriodDates(periodChip);
  }, [periodChip, periodType, startDate, endDate]);

  const reportQuery = useStudentReport(
    studentId,
    undefined,
    periodParams.periodType,
    periodParams.startDate ?? undefined,
    periodParams.endDate ?? undefined
  );
  const classReportQuery = useClassReport(classSectionId);
  const { data: publicCounts, isLoading: publicLoading } = usePublicClassCounts();

  const classList = (classSectionsQuery.data?.data as ClassSection[] | undefined) ?? [];
  const classOptions = classList.map((cs) => ({
    value: cs.id,
    label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
  }));

  const students = (studentsQuery.data?.data as Student[] | undefined) ?? [];
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.fullName ?? 'Unknown'} (${s.studentId})`,
  }));

  useEffect(() => {
    if (isStudent && myStudentQuery.data?.data?.id && !studentId) {
      setStudentId(myStudentQuery.data.data.id);
    }
  }, [isStudent, myStudentQuery.data?.data, studentId]);

  const report = classReportQuery.data;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Report</Title>
        </Group>
      </div>
      <div className="page-sub-title-bar" />

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="student" leftSection={<IconUser size={16} />}>
              Student report
            </Tabs.Tab>
            <Tabs.Tab value="class" leftSection={<IconUsersGroup size={16} />}>
              Class report
            </Tabs.Tab>
            <Tabs.Tab value="public" leftSection={<IconChartBar size={16} />}>
              Public report
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="student" pt="md" px="md" pb="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <Text size="sm" fw={500}>
                      Report period
                    </Text>
                    {studentId && (
                      <ExportButton variant="student" studentId={studentId} />
                    )}
                  </Group>
                  <Chip.Group
                    className="filter-chip-group"
                    value={periodType === ReportPeriodType.CUSTOM ? 'custom' : periodChip}
                    onChange={(v) => {
                      if (v === 'custom') {
                        setPeriodType(ReportPeriodType.CUSTOM);
                      } else {
                        setPeriodChip(v ?? 'year');
                        setPeriodType(null);
                        setStartDate(null);
                        setEndDate(null);
                      }
                    }}
                  >
                    <Group gap="xs">
                      <Chip value="year" variant="filled">
                        Year to date
                      </Chip>
                      <Chip value="week" variant="filled">
                        This week
                      </Chip>
                      <Chip value="month" variant="filled">
                        This month
                      </Chip>
                      <Chip value="custom" variant="filled">
                        Custom range
                      </Chip>
                    </Group>
                  </Chip.Group>
                  {periodType === ReportPeriodType.CUSTOM && (
                    <ReportPeriodSelector
                      value={periodType}
                      startDate={startDate}
                      endDate={endDate}
                      onChange={(type, start, end) => {
                        setPeriodType(type);
                        setStartDate(start);
                        setEndDate(end);
                      }}
                    />
                  )}
                  {isStudent ? (
                    <Alert color="blue">
                      <Text fw={600}>Your report</Text>
                      <Text size="sm">Viewing your own report.</Text>
                    </Alert>
                  ) : (
                    <Select
                      label="Student"
                      placeholder="Choose a student"
                      data={studentOptions}
                      value={studentId}
                      onChange={setStudentId}
                      clearable
                      searchable
                      style={{ maxWidth: 400 }}
                    />
                  )}
                </Stack>
              </Paper>
              {!studentId ? (
                <Text c="dimmed" size="sm">Select a student to view their report.</Text>
              ) : (
                <StudentReportCard
                  report={reportQuery.data ?? null}
                  isLoading={reportQuery.isLoading}
                />
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="class" pt="md" px="md" pb="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <Text size="sm" fw={500}>
                      Class section
                    </Text>
                    {classSectionId && (
                      <ExportButton variant="class" classSectionId={classSectionId} />
                    )}
                  </Group>
                  <Box style={{ maxWidth: 400 }}>
                    <Select
                      placeholder="Choose a class section"
                      data={classOptions}
                      value={classSectionId}
                      onChange={setClassSectionId}
                      clearable
                      searchable
                    />
                  </Box>
                </Stack>
              </Paper>
              {!classSectionId ? (
                <Text c="dimmed" size="sm">Select a class section to view the report.</Text>
              ) : classReportQuery.isLoading ? (
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
          </Tabs.Panel>

          <Tabs.Panel value="public" pt="md" px="md" pb="md">
            <Stack gap="md">
              <Paper withBorder p="md">
                <Text fw={600} mb="md">Student counts by class</Text>
                {publicLoading ? (
                  <Stack gap="sm">
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                    <Skeleton height={40} />
                  </Stack>
                ) : publicCounts && publicCounts.length > 0 ? (
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Class</Table.Th>
                        <Table.Th>Section</Table.Th>
                        <Table.Th>Total Students</Table.Th>
                        <Table.Th>Boys</Table.Th>
                        <Table.Th>Girls</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {publicCounts.map((count) => (
                        <Table.Tr key={count.classSectionId}>
                          <Table.Td>{count.className}</Table.Td>
                          <Table.Td>{count.sectionName}</Table.Td>
                          <Table.Td>{count.totalStudents}</Table.Td>
                          <Table.Td>{count.maleCount}</Table.Td>
                          <Table.Td>{count.femaleCount}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text c="dimmed" size="sm">No class data available.</Text>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
