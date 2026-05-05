'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { IconUser, IconUsersGroup, IconChartBar, IconReportAnalytics } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
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
import { AdministrativeReportContent } from '@/components/features/reports/AdministrativeReportContent';

function getPeriodDates(period: string): { periodType: ReportPeriodType; startDate: string | null; endDate: string | null } {
  const now = new Date();
  if (period === 'all') {
    return { periodType: ReportPeriodType.ALL, startDate: null, endDate: null };
  }
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

  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('reports');
  const { user } = useAuth();
  const isStudent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'student') ?? false;
  const isParent = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'parent') ?? false;
  const isTeacher = user?.roles?.some((r) => {
    const n = r.roleName?.toLowerCase();
    return n === 'subject_teacher' || n === 'class_teacher';
  }) ?? false;
  const canManageReports = user?.roles?.some((r) => {
    const n = r.roleName?.toLowerCase();
    return n === 'school_admin' || n === 'principal' || n === 'academic_coordinator';
  }) ?? false;
  const showAdministrativeTab = !isParent && !isStudent && (isTeacher || canManageReports);
  const myStudentQuery = useMyStudent();
  const studentsQuery = useStudents({ limit: 100 });
  const classSectionsQuery = useClassSections({ limit: 200, minimal: true });

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
  const classOptions = classList
    .sort((a, b) => {
      // Sort by class sort order first, then by section sort order
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) {
        return classOrderA - classOrderB;
      }
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));

  const students = (studentsQuery.data?.data as Student[] | undefined) ?? [];
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Unknown'} (${s.studentId})`,
  }));

  useEffect(() => {
    if (isStudent && myStudentQuery.data?.data?.id && !studentId) {
      setStudentId(myStudentQuery.data.data.id);
    }
  }, [isStudent, myStudentQuery.data?.data, studentId]);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab === 'administrative' && showAdministrativeTab) {
      setActiveTab('administrative');
    }
  }, [searchParams, showAdministrativeTab]);

  const handleTabChange = (value: string | null) => {
    setActiveTab(value);
    if (value === 'administrative') {
      router.replace('/reports?tab=administrative', { scroll: false });
    }
  };

  const report = classReportQuery.data;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
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
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab value="student" leftSection={<IconUser size={16} />}>
              {t('studentTab')}
            </Tabs.Tab>
            <Tabs.Tab value="class" leftSection={<IconUsersGroup size={16} />}>
              {t('classTab')}
            </Tabs.Tab>
            <Tabs.Tab value="public" leftSection={<IconChartBar size={16} />}>
              {t('publicTab')}
            </Tabs.Tab>
            {showAdministrativeTab && (
              <Tabs.Tab value="administrative" leftSection={<IconReportAnalytics size={16} />}>
                {t('administrativeTab')}
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="student" pt="md" px="md" pb="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Stack gap="md">
                  <Group justify="space-between" wrap="wrap" gap="sm">
                    <Text size="sm" fw={500}>
                      {t('reportPeriodLabel')}
                    </Text>
                    {studentId && (
                      <ExportButton variant="student" studentId={studentId} />
                    )}
                  </Group>
                  <Chip.Group
                    value={periodType === ReportPeriodType.CUSTOM ? 'custom' : periodChip}
                    onChange={(v) => {
                      const value = Array.isArray(v) ? v[0] : v;
                      if (value === 'custom') {
                        setPeriodType(ReportPeriodType.CUSTOM);
                      } else {
                        setPeriodChip(value ?? 'year');
                        setPeriodType(null);
                        setStartDate(null);
                        setEndDate(null);
                      }
                    }}
                  >
                    <Group gap="xs">
                      <Chip value="all" variant="filled">
                        {t('chipAll')}
                      </Chip>
                      <Chip value="year" variant="filled">
                        {t('chipYearToDate')}
                      </Chip>
                      <Chip value="week" variant="filled">
                        {t('chipThisWeek')}
                      </Chip>
                      <Chip value="month" variant="filled">
                        {t('chipThisMonth')}
                      </Chip>
                      <Chip value="custom" variant="filled">
                        {t('chipCustomRange')}
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
                      <Text fw={600}>{t('studentSelfTitle')}</Text>
                      <Text size="sm">{t('studentSelfDescription')}</Text>
                    </Alert>
                  ) : (
                    <Select
                      label={t('studentSelectLabel')}
                      placeholder={t('studentSelectPlaceholder')}
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
                <Text c="dimmed" size="sm">
                  {t('studentSelectHint')}
                </Text>
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
                      {t('classSectionLabel')}
                    </Text>
                    {classSectionId && (
                      <ExportButton variant="class" classSectionId={classSectionId} />
                    )}
                  </Group>
                  <Box style={{ maxWidth: 400 }}>
                    <Select
                      placeholder={t('classSelectPlaceholder')}
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
                <Text c="dimmed" size="sm">
                  {t('classSelectHint')}
                </Text>
              ) : classReportQuery.isLoading ? (
                <Skeleton height={200} radius="sm" />
              ) : !report ? (
                <Text c="dimmed">{t('classNoReportData')}</Text>
              ) : (
                <>
                  <Text fw={600}>
                    {report.className} {report.sectionName}
                  </Text>
                  <Paper withBorder p="md">
                    <Text fw={600} mb="md">
                      {t('classAttendanceTitle')}
                    </Text>
                    <Table withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('tableStudent')}</Table.Th>
                          <Table.Th>{t('tablePresent')}</Table.Th>
                          <Table.Th>{t('tableTotalDays')}</Table.Th>
                          <Table.Th>{t('tableAttendancePercent')}</Table.Th>
                          <Table.Th>{t('tableAverageGradePercent')}</Table.Th>
                          <Table.Th>{t('tableAssignmentViewing')}</Table.Th>
                          <Table.Th>{t('tableAssignmentSubmission')}</Table.Th>
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
                                <Text c="dimmed">{t('tableDash')}</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {s.assignmentStatistics ? (
                                <Text size="sm">
                                  {s.assignmentStatistics.viewedAssignments}/{s.assignmentStatistics.totalAssignments} ({s.assignmentStatistics.viewingRate}%)
                                </Text>
                              ) : (
                                <Text c="dimmed" size="sm">
                                  {t('tableDash')}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {s.assignmentStatistics ? (
                                <Text size="sm">
                                  {s.assignmentStatistics.submittedAssignments}/{s.assignmentStatistics.totalAssignments} ({s.assignmentStatistics.submissionRate}%)
                                </Text>
                              ) : (
                                <Text c="dimmed" size="sm">
                                  {t('tableDash')}
                                </Text>
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
                <Text fw={600} mb="md">
                  {t('publicStudentCountsTitle')}
                </Text>
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
                          <Table.Th>{t('publicTableClass')}</Table.Th>
                          <Table.Th>{t('publicTableSection')}</Table.Th>
                          <Table.Th>{t('publicTableTotalStudents')}</Table.Th>
                          <Table.Th>{t('publicTableBoys')}</Table.Th>
                          <Table.Th>{t('publicTableGirls')}</Table.Th>
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
                  <Text c="dimmed" size="sm">
                    {t('publicNoData')}
                  </Text>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>

          {showAdministrativeTab && (
            <Tabs.Panel value="administrative" pt="md" px="md" pb="md">
              <AdministrativeReportContent
                classOptions={classOptions}
                classList={classList}
                isActive={activeTab === 'administrative'}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      </div>
    </>
  );
}
