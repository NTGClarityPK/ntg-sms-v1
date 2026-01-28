'use client';

import { useState, useEffect } from 'react';
import {
  Paper,
  Stack,
  Button,
  Loader,
  Text,
  Group,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react';
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
  const bulkMarkMutation = useBulkMarkAttendance();
  const notifyColors = useThemeColors();

  // Sync local state with prop changes
  useEffect(() => {
    setLocalAttendance(attendance);
  }, [attendance]);

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
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading attendance data...</Text>
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
        <Group justify="space-between">
          <Text fw={500} size="lg">
            {className} - {sectionName}
          </Text>
          <Button
            leftSection={<IconDeviceFloppy size={18} />}
            onClick={handleSave}
            loading={bulkMarkMutation.isPending}
          >
            Save Attendance
          </Button>
        </Group>

        <Stack gap="xs">
          {localAttendance.map((record) => (
            <StudentRow
              key={record.studentId}
              attendance={record}
              onStatusChange={(status) => handleStatusChange(record.studentId, status)}
              onTimeChange={(field, value) =>
                handleTimeChange(record.studentId, field, value)
              }
              onNotesChange={(notes) => handleNotesChange(record.studentId, notes)}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}



