'use client';

import { useState, useMemo } from 'react';
import {
  Group,
  Tabs,
  Paper,
  Stack,
  Text,
  Chip,
  Select,
  Table,
  Badge,
  Skeleton,
  Button,
  Menu,
  Alert,
} from '@mantine/core';
import {
  IconCalendar,
  IconSchool,
  IconFileExport,
  IconFileTypePdf,
  IconFileSpreadsheet,
  IconFolderOff,
} from '@tabler/icons-react';
import { useClassSections } from '@/hooks/useClassSections';
import { useSubjects } from '@/hooks/useCoreLookups';
import {
  useAttendanceSummary,
  useLowAttendance,
  useAttendanceReportByClass,
  useAcademicReportByClass,
  useAcademicReportBySubject,
} from '@/hooks/useReports';
import { apiClient } from '@/lib/api-client';
import { saveDocumentForOffline } from '@/lib/offline/documents';
import { notifications } from '@mantine/notifications';
import type { ClassSection } from '@/types/class-sections';

function getPeriodDates(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  if (period === 'year') {
    const y = now.getFullYear();
    return { startDate: `${y}-01-01`, endDate: now.toISOString().split('T')[0] };
  }
  if (period === 'week') {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startDate: monday.toISOString().split('T')[0],
      endDate: sunday.toISOString().split('T')[0],
    };
  }
  if (period === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const last = new Date(y, m + 1, 0);
    return {
      startDate: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      endDate: last.toISOString().split('T')[0],
    };
  }
  const y = now.getFullYear();
  return { startDate: `${y}-01-01`, endDate: now.toISOString().split('T')[0] };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AdministrativeReportContent() {
  const [activeTab, setActiveTab] = useState<string | null>('attendance');
  const [periodChip, setPeriodChip] = useState<string>('month');
  const [thresholdChip, setThresholdChip] = useState<string>('80');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const { startDate, endDate } = useMemo(() => getPeriodDates(periodChip), [periodChip]);

  const classSectionsQuery = useClassSections({ limit: 200, minimal: true });
  const subjectsQuery = useSubjects();

  const classList = (classSectionsQuery.data?.data as ClassSection[] | undefined) ?? [];
  const classOptions = classList.map((cs) => ({
    value: cs.id,
    label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
  }));

  const subjectList = (subjectsQuery.data as { data?: { id: string; name?: string; display_name?: string }[] } | undefined)?.data ?? [];
  const subjectOptions = subjectList.map((s) => ({
    value: s.id,
    label: s.display_name ?? s.name ?? s.id,
  }));

  const summaryQuery = useAttendanceSummary(startDate, endDate);
  const lowQuery = useLowAttendance(startDate, endDate, parseInt(thresholdChip, 10) || 80);
  const attendanceClassQuery = useAttendanceReportByClass(classSectionId, startDate, endDate);
  const academicClassQuery = useAcademicReportByClass(classSectionId);
  const academicSubjectQuery = useAcademicReportBySubject(subjectId);

  const handleAttendanceExport = async (format: 'pdf' | 'excel') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({
        format,
        startDate,
        endDate,
      });
      if (classSectionId) params.set('classSectionId', classSectionId);
      const blob = await apiClient.getBlob(`/api/v1/reports/attendance/export?${params}`);
      triggerDownload(blob, `attendance-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleAcademicExport = async (format: 'pdf' | 'excel') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({ format });
      if (classSectionId) params.set('classSectionId', classSectionId);
      if (subjectId) params.set('subjectId', subjectId);
      const blob = await apiClient.getBlob(`/api/v1/reports/academic/export?${params}`);
      triggerDownload(blob, `academic-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleSaveAttendanceOffline = async (format: 'pdf' | 'excel') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({ format, startDate, endDate });
      if (classSectionId) params.set('classSectionId', classSectionId);
      const blob = await apiClient.getBlob(`/api/v1/reports/attendance/export?${params}`);
      const type = format === 'pdf' ? 'report_pdf' : 'report_excel';
      const title = `Attendance report (${format.toUpperCase()}) ${startDate}–${endDate}`;
      await saveDocumentForOffline(title, type, `/api/v1/reports/attendance/export?${params}`, blob);
      notifications.show({ title: 'Saved for offline', message: 'You can open it from Offline documents.', color: 'green' });
    } catch (e) {
      notifications.show({
        title: 'Failed to save',
        message: e instanceof Error ? e.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleSaveAcademicOffline = async (format: 'pdf' | 'excel') => {
    setExportLoading(true);
    try {
      const params = new URLSearchParams({ format });
      if (classSectionId) params.set('classSectionId', classSectionId);
      if (subjectId) params.set('subjectId', subjectId);
      const blob = await apiClient.getBlob(`/api/v1/reports/academic/export?${params}`);
      const type = format === 'pdf' ? 'report_pdf' : 'report_excel';
      const title = `Academic report (${format.toUpperCase()})`;
      await saveDocumentForOffline(title, type, `/api/v1/reports/academic/export?${params}`, blob);
      notifications.show({ title: 'Saved for offline', message: 'You can open it from Offline documents.', color: 'green' });
    } catch (e) {
      notifications.show({
        title: 'Failed to save',
        message: e instanceof Error ? e.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <Tabs value={activeTab} onChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Tab value="attendance" leftSection={<IconCalendar size={16} />}>
          Attendance
        </Tabs.Tab>
        <Tabs.Tab value="academic" leftSection={<IconSchool size={16} />}>
          Academic
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="attendance" pt="md" px="md" pb="md">
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between" wrap="wrap" gap="sm" align="center">
                <Group gap="xs" wrap="wrap" className="filter-chip-group">
                  <Text size="sm" fw={500}>
                    Period:
                  </Text>
                  <Chip.Group value={periodChip} onChange={(v) => setPeriodChip(Array.isArray(v) ? v[0] ?? 'month' : (v ?? 'month'))}>
                    <Group gap="xs">
                      <Chip value="week" variant="filled">Week</Chip>
                      <Chip value="month" variant="filled">Month</Chip>
                      <Chip value="year" variant="filled">Year</Chip>
                    </Group>
                  </Chip.Group>
                </Group>
                <Menu shadow="md" width={160} disabled={exportLoading}>
                  <Menu.Target>
                    <Button
                      leftSection={exportLoading ? undefined : <IconFileExport size={16} />}
                      variant="light"
                      loading={exportLoading}
                    >
                      Export
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconFileTypePdf size={14} />}
                      onClick={() => handleAttendanceExport('pdf')}
                    >
                      PDF
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconFileSpreadsheet size={14} />}
                      onClick={() => handleAttendanceExport('excel')}
                    >
                      Excel
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconFolderOff size={14} />}
                      onClick={() => handleSaveAttendanceOffline('pdf')}
                    >
                      Save PDF for offline
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconFolderOff size={14} />}
                      onClick={() => handleSaveAttendanceOffline('excel')}
                    >
                      Save Excel for offline
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
              <Group gap="xs" wrap="wrap" className="filter-chip-group">
                <Text size="sm" fw={500}>
                  Low attendance threshold:
                </Text>
                <Chip.Group value={thresholdChip} onChange={(v) => setThresholdChip(Array.isArray(v) ? v[0] ?? '80' : (v ?? '80'))}>
                  <Group gap="xs">
                    <Chip value="70" variant="filled">Below 70%</Chip>
                    <Chip value="80" variant="filled">Below 80%</Chip>
                    <Chip value="90" variant="filled">Below 90%</Chip>
                  </Group>
                </Chip.Group>
              </Group>
              <Select
                label="Class section (optional)"
                placeholder="All classes"
                data={classOptions}
                value={classSectionId}
                onChange={setClassSectionId}
                clearable
                searchable
                style={{ maxWidth: 320 }}
              />
            </Stack>
          </Paper>

          {summaryQuery.isLoading || summaryQuery.isFetching ? (
            <Skeleton height={200} />
          ) : summaryQuery.error ? (
            <Alert color="red">{String(summaryQuery.error?.message ?? 'Failed to load summary')}</Alert>
          ) : summaryQuery.data && !classSectionId ? (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">Branch summary</Text>
              <Text size="sm" c="dimmed">
                {summaryQuery.data.startDate} to {summaryQuery.data.endDate} · Overall average:{' '}
                {summaryQuery.data.overall.averageAttendance}% · Total students:{' '}
                {summaryQuery.data.overall.totalStudents}
              </Text>
              {summaryQuery.data.byClass.length > 0 && (
                <Table mt="md" withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Class</Table.Th>
                      <Table.Th>Section</Table.Th>
                      <Table.Th>Avg %</Table.Th>
                      <Table.Th>Students</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {summaryQuery.data.byClass.map((c) => (
                      <Table.Tr key={c.classSectionId}>
                        <Table.Td>{c.className}</Table.Td>
                        <Table.Td>{c.sectionName}</Table.Td>
                        <Table.Td>{c.averageAttendance}%</Table.Td>
                        <Table.Td>{c.studentCount}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          ) : null}

          {classSectionId && attendanceClassQuery.data ? (
            <Paper p="md" withBorder>
              <Text fw={600} mb="sm">
                {attendanceClassQuery.data.className} {attendanceClassQuery.data.sectionName}
              </Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Student</Table.Th>
                    <Table.Th>Present</Table.Th>
                    <Table.Th>Absent</Table.Th>
                    <Table.Th>Late</Table.Th>
                    <Table.Th>%</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {attendanceClassQuery.data.students.map((s) => (
                    <Table.Tr key={s.studentId}>
                      <Table.Td>{s.studentName}</Table.Td>
                      <Table.Td>{s.presentDays}</Table.Td>
                      <Table.Td>{s.absentDays}</Table.Td>
                      <Table.Td>{s.lateDays}</Table.Td>
                      <Table.Td>{s.percentage}%</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          ) : classSectionId && attendanceClassQuery.isLoading ? (
            <Skeleton height={180} />
          ) : null}

          <Paper p="md" withBorder>
            <Text fw={600} mb="sm">Students below threshold</Text>
            {lowQuery.isLoading ? (
              <Skeleton height={120} />
            ) : lowQuery.data?.students.length === 0 ? (
              <Text size="sm" c="dimmed">No students below {lowQuery.data?.threshold ?? 80}%.</Text>
            ) : lowQuery.data?.students.length ? (
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Student</Table.Th>
                    <Table.Th>Class</Table.Th>
                    <Table.Th>%</Table.Th>
                    <Table.Th>Present / Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lowQuery.data.students.map((s) => (
                    <Table.Tr key={`${s.studentId}-${s.classSectionId}`}>
                      <Table.Td>{s.studentName}</Table.Td>
                      <Table.Td>{s.className} {s.sectionName}</Table.Td>
                      <Table.Td>
                        <Badge color={s.percentage < 50 ? 'red' : 'yellow'}>{s.percentage}%</Badge>
                      </Table.Td>
                      <Table.Td>{s.presentDays} / {s.totalDays}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : null}
          </Paper>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="academic" pt="md" px="md" pb="md">
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Text size="sm" fw={500}>
                  Academic report
                </Text>
                <Menu shadow="md" width={160} disabled={exportLoading}>
                  <Menu.Target>
                    <Button
                      leftSection={exportLoading ? undefined : <IconFileExport size={16} />}
                      variant="light"
                      loading={exportLoading}
                      disabled={!classSectionId && !subjectId}
                    >
                      Export
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconFileTypePdf size={14} />}
                      onClick={() => handleAcademicExport('pdf')}
                      disabled={!classSectionId && !subjectId}
                    >
                      PDF
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconFileSpreadsheet size={14} />}
                      onClick={() => handleAcademicExport('excel')}
                      disabled={!classSectionId && !subjectId}
                    >
                      Excel
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<IconFolderOff size={14} />}
                      onClick={() => handleSaveAcademicOffline('pdf')}
                      disabled={!classSectionId && !subjectId}
                    >
                      Save PDF for offline
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconFolderOff size={14} />}
                      onClick={() => handleSaveAcademicOffline('excel')}
                      disabled={!classSectionId && !subjectId}
                    >
                      Save Excel for offline
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
              <Select
                label="Class section"
                placeholder="Choose class"
                data={classOptions}
                value={classSectionId}
                onChange={(v) => {
                  setClassSectionId(v);
                  if (v) setSubjectId(null);
                }}
                clearable
                searchable
                style={{ maxWidth: 320 }}
              />
              <Select
                label="Subject"
                placeholder="Choose subject"
                data={subjectOptions}
                value={subjectId}
                onChange={(v) => {
                  setSubjectId(v);
                  if (v) setClassSectionId(null);
                }}
                clearable
                searchable
                style={{ maxWidth: 320 }}
              />
            </Stack>
          </Paper>

          {classSectionId && (
            academicClassQuery.isLoading ? (
              <Skeleton height={200} />
            ) : academicClassQuery.error ? (
              <Alert color="red">{String(academicClassQuery.error?.message)}</Alert>
            ) : academicClassQuery.data ? (
              <Paper p="md" withBorder>
                <Text fw={600} mb="sm">
                  {academicClassQuery.data.className} {academicClassQuery.data.sectionName}
                </Text>
                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Student</Table.Th>
                      <Table.Th>Attendance %</Table.Th>
                      <Table.Th>Average %</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {academicClassQuery.data.students.map((s) => (
                      <Table.Tr key={s.studentId}>
                        <Table.Td>{s.studentName}</Table.Td>
                        <Table.Td>{s.attendancePercentage}%</Table.Td>
                        <Table.Td>{s.averagePercentage ?? '-'}%</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            ) : null
          )}

          {subjectId && (
            academicSubjectQuery.isLoading ? (
              <Skeleton height={200} />
            ) : academicSubjectQuery.error ? (
              <Alert color="red">{String(academicSubjectQuery.error?.message)}</Alert>
            ) : academicSubjectQuery.data ? (
              <Paper p="md" withBorder>
                <Text fw={600} mb="sm">{academicSubjectQuery.data.subjectName}</Text>
                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Class</Table.Th>
                      <Table.Th>Section</Table.Th>
                      <Table.Th>Avg %</Table.Th>
                      <Table.Th>Students</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {academicSubjectQuery.data.byClass.map((c) => (
                      <Table.Tr key={c.classSectionId}>
                        <Table.Td>{c.className}</Table.Td>
                        <Table.Td>{c.sectionName}</Table.Td>
                        <Table.Td>{c.averagePercentage}%</Table.Td>
                        <Table.Td>{c.studentCount}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Paper>
            ) : null
          )}

          {!classSectionId && !subjectId && (
            <Text size="sm" c="dimmed">Select a class section or subject to view the report.</Text>
          )}
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}
