'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Paper,
  Stack,
  Button,
  Skeleton,
  Text,
  Group,
  Alert,
  Table,
  ScrollArea,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy, IconSearch } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import type { Attendance } from '@/types/attendance';
import { StudentRow } from './StudentRow';
import { useBulkMarkAttendance } from '@/hooks/useAttendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface AttendanceSheetProps {
  classSectionId: string;
  date: string;
  attendance: Attendance[];
  isLoading: boolean;
  className: string;
  sectionName: string;
}

export function AttendanceSheet({
  classSectionId,
  date,
  attendance,
  isLoading,
  className,
  sectionName,
}: AttendanceSheetProps) {
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const bulkMarkMutation = useBulkMarkAttendance();
  const notifyColors = useThemeColors();

  // Sync local state with prop changes
  useEffect(() => {
    setLocalAttendance(attendance);
  }, [attendance]);

  // Filter students by search query
  const filteredAttendance = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return localAttendance;
    }
    const query = debouncedSearch.toLowerCase().trim();
    return localAttendance.filter(
      (record) =>
        record.studentName.toLowerCase().includes(query) ||
        record.studentIdNumber?.toLowerCase().includes(query) ||
        false,
    );
  }, [localAttendance, debouncedSearch]);

  const handleStatusChange = (studentId: string, status: Attendance['status']) => {
    setLocalAttendance((prev) =>
      prev.map((a) =>
        a.studentId === studentId
          ? { ...a, status, entryTime: status === 'present' || status === 'late' ? new Date().toTimeString().slice(0, 5) : undefined }
          : a,
      ),
    );
  };

  const handleTimeChange = (
    studentId: string,
    field: 'entryTime' | 'exitTime',
    value: string,
  ) => {
    setLocalAttendance((prev) =>
      prev.map((a) =>
        a.studentId === studentId ? { ...a, [field]: value } : a,
      ),
    );
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setLocalAttendance((prev) =>
      prev.map((a) => (a.studentId === studentId ? { ...a, notes } : a)),
    );
  };

  const handleSave = async () => {
    if (bulkMarkMutation.isPending) return;

    const records = localAttendance.map((a) => ({
      studentId: a.studentId,
      status: a.status,
      entryTime: a.entryTime,
      exitTime: a.exitTime,
      notes: a.notes,
    }));

    await bulkMarkMutation.mutateAsync({
      classSectionId,
      date,
      records,
    });
  };

  // CRITICAL: Use isLoading || !attendance pattern as per mistakes.md
  if (isLoading || !attendance) {
    return (
      <Paper withBorder p="xl">
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={300} />
          <Skeleton height={50} />
        </Stack>
      </Paper>
    );
  }

  if (attendance.length === 0) {
    return (
      <Paper withBorder p="xl">
        <Alert icon={<IconAlertCircle size={16} />} color={notifyColors.warning}>
          No students found in this class-section. Please ensure students are enrolled.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between" mb="md">
          <Text fw={500} size="lg">
            {className} - {sectionName}
          </Text>
          <Button
            leftSection={<IconDeviceFloppy size={18} />}
            onClick={handleSave}
            loading={bulkMarkMutation.isPending}
            disabled={bulkMarkMutation.isPending || isLoading}
          >
            Save Attendance
          </Button>
        </Group>

        <TextInput
          placeholder="Search by student name or ID..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          mb="md"
        />

        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Student</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Entry Time</Table.Th>
                <Table.Th>Exit Time</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAttendance.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" size="sm" ta="center" py="md">
                      {debouncedSearch.trim()
                        ? 'No students found matching your search'
                        : 'No students found'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredAttendance.map((record) => (
                  <StudentRow
                    key={record.studentId}
                    attendance={record}
                    onStatusChange={(status) => handleStatusChange(record.studentId, status)}
                    onTimeChange={(field, value) =>
                      handleTimeChange(record.studentId, field, value)
                    }
                    onNotesChange={(notes) => handleNotesChange(record.studentId, notes)}
                  />
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}



