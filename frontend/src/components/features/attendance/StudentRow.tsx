'use client';

import { useState, useEffect } from 'react';
import {
  Group,
  Avatar,
  Text,
  SegmentedControl,
  TextInput,
  Textarea,
  Badge,
  Stack,
  Paper,
} from '@mantine/core';
import type { Attendance, AttendanceStatus } from '@/types/attendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface StudentRowProps {
  attendance: Attendance;
  onStatusChange: (status: AttendanceStatus) => void;
  onTimeChange: (field: 'entryTime' | 'exitTime', value: string) => void;
  onNotesChange: (notes: string) => void;
}

export function StudentRow({
  attendance,
  onStatusChange,
  onTimeChange,
  onNotesChange,
}: StudentRowProps) {
  const [entryTime, setEntryTime] = useState(attendance.entryTime || '');
  const [exitTime, setExitTime] = useState(attendance.exitTime || '');
  const [notes, setNotes] = useState(attendance.notes || '');
  const notifyColors = useThemeColors();

  // CRITICAL: Pre-populate form when attendance prop changes (as per mistakes.md)
  useEffect(() => {
    setEntryTime(attendance.entryTime || '');
    setExitTime(attendance.exitTime || '');
    setNotes(attendance.notes || '');
  }, [attendance]);

  const getStatusColor = (status: AttendanceStatus) => {
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

  const handleStatusChange = (value: string) => {
    onStatusChange(value as AttendanceStatus);
    // Auto-fill entry time for present/late
    if (value === 'present' || value === 'late') {
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setEntryTime(timeString);
      onTimeChange('entryTime', timeString);
    } else {
      setEntryTime('');
      onTimeChange('entryTime', '');
    }
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Avatar size="md" radius="xl">
              {attendance.studentName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Avatar>
            <Stack gap={2}>
              <Text fw={500}>{attendance.studentName}</Text>
              <Text size="xs" c="dimmed">
                {attendance.studentIdNumber || 'Student ID: N/A'}
              </Text>
            </Stack>
          </Group>
          <Badge variant="light" color={getStatusColor(attendance.status)}>
            {attendance.status.toUpperCase()}
          </Badge>
        </Group>

        <SegmentedControl
          value={attendance.status}
          onChange={handleStatusChange}
          data={[
            { label: 'Present', value: 'present' },
            { label: 'Absent', value: 'absent' },
            { label: 'Late', value: 'late' },
            { label: 'Excused', value: 'excused' },
          ]}
          fullWidth
        />

        <Group grow>
          <TextInput
            label="Entry Time"
            type="time"
            value={entryTime}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setEntryTime(value);
              onTimeChange('entryTime', value);
            }}
            disabled={attendance.status === 'absent'}
          />
          <TextInput
            label="Exit Time"
            type="time"
            value={exitTime}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setExitTime(value);
              onTimeChange('exitTime', value);
            }}
          />
        </Group>

        <Textarea
          label="Notes"
          placeholder="Optional notes..."
          value={notes}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setNotes(value);
            onNotesChange(value);
          }}
          minRows={2}
        />
      </Stack>
    </Paper>
  );
}

