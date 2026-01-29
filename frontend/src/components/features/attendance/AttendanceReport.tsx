'use client';

import {
  Paper,
  Stack,
  Text,
  Skeleton,
  Table,
  Badge,
  Group,
  Button,
} from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import type { Attendance } from '@/types/attendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface AttendanceReportProps {
  attendance: Attendance[];
  isLoading: boolean;
  startDate?: string;
  endDate?: string;
}

export function AttendanceReport({
  attendance,
  isLoading,
  startDate,
  endDate,
}: AttendanceReportProps) {
  const notifyColors = useThemeColors();

  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={300} />
        </Stack>
      </Paper>
    );
  }

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const lateCount = attendance.filter((a) => a.status === 'late').length;
  const excusedCount = attendance.filter((a) => a.status === 'excused').length;
  const total = attendance.length;
  const presentPercentage =
    total > 0
      ? Math.round(((presentCount + lateCount) / total) * 100)
      : 0;

  const getStatusColor = (status: Attendance['status']) => {
    switch (status) {
      case 'present':
        return notifyColors.success;
      case 'absent':
        return notifyColors.error;
      case 'late':
        return notifyColors.warning;
      case 'excused':
        return notifyColors.info;
      default:
        return notifyColors.primary;
    }
  };

  const handleExport = () => {
    // Future: Export to CSV/Excel
    const csv = [
      ['Date', 'Student Name', 'Student ID', 'Class', 'Section', 'Status', 'Entry Time', 'Exit Time', 'Notes'].join(','),
      ...attendance.map((a) =>
        [
          a.date,
          a.studentName,
          a.studentIdNumber || a.studentId,
          a.className,
          a.sectionName,
          a.status,
          a.entryTime || '',
          a.exitTime || '',
          (a.notes || '').replace(/,/g, ';'),
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${startDate || 'all'}-${endDate || 'all'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500} size="lg">
            Attendance Report
          </Text>
          {attendance.length > 0 && (
            <Button
              leftSection={<IconDownload size={18} />}
              variant="light"
              onClick={handleExport}
            >
              Export CSV
            </Button>
          )}
        </Group>

        {startDate || endDate ? (
          <Text size="sm" c="dimmed">
            Period: {startDate ? new Date(startDate).toLocaleDateString() : 'All'} -{' '}
            {endDate ? new Date(endDate).toLocaleDateString() : 'All'}
          </Text>
        ) : null}

        <Group grow>
          <Paper withBorder p="sm">
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Total Records
              </Text>
              <Text fw={600} size="xl">
                {total}
              </Text>
            </Stack>
          </Paper>
          <Paper withBorder p="sm">
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Present
              </Text>
              <Badge variant="light" color={notifyColors.success} size="lg">
                {presentCount}
              </Badge>
            </Stack>
          </Paper>
          <Paper withBorder p="sm">
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Absent
              </Text>
              <Badge variant="light" color={notifyColors.error} size="lg">
                {absentCount}
              </Badge>
            </Stack>
          </Paper>
          <Paper withBorder p="sm">
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Late
              </Text>
              <Badge variant="light" color={notifyColors.warning} size="lg">
                {lateCount}
              </Badge>
            </Stack>
          </Paper>
          <Paper withBorder p="sm">
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Attendance Rate
              </Text>
              <Text fw={600} size="xl">
                {presentPercentage}%
              </Text>
            </Stack>
          </Paper>
        </Group>

        {attendance.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No attendance records found for the selected filters
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th>Student Name</Table.Th>
                <Table.Th>Student ID</Table.Th>
                <Table.Th>Class</Table.Th>
                <Table.Th>Section</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Entry Time</Table.Th>
                <Table.Th>Exit Time</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {attendance.map((record) => (
                <Table.Tr key={`${record.id}-${record.date}-${record.studentId}`}>
                  <Table.Td>{new Date(record.date).toLocaleDateString()}</Table.Td>
                  <Table.Td>{record.studentName}</Table.Td>
                  <Table.Td>{record.studentIdNumber || record.studentId}</Table.Td>
                  <Table.Td>{record.className}</Table.Td>
                  <Table.Td>{record.sectionName}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={getStatusColor(record.status)}>
                      {record.status.toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{record.entryTime || '-'}</Table.Td>
                  <Table.Td>{record.exitTime || '-'}</Table.Td>
                  <Table.Td>{record.notes || '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  );
}



