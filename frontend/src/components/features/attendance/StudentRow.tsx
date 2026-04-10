'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Group,
  Avatar,
  Text,
  TextInput,
  Textarea,
  Table,
  Button,
  Popover,
  ActionIcon,
} from '@mantine/core';
import { IconNotes } from '@tabler/icons-react';
import type { Attendance, AttendanceStatus } from '@/types/attendance';
import { displayStudentId } from '@/lib/utils/student-display';
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
  const t = useTranslations('attendance');
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

  const handleStatusChange = (value: AttendanceStatus) => {
    onStatusChange(value);
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

  const statusButtons: { value: AttendanceStatus; label: string; color: string }[] = [
    { value: 'present', label: 'P', color: notifyColors.success },
    { value: 'absent', label: 'A', color: notifyColors.error },
    { value: 'late', label: 'L', color: notifyColors.warning },
  ];

  const selectedBorderColour = 'var(--mantine-color-yellow-4)';

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar size="sm" radius="xl">
            {attendance.studentName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Avatar>
          <div>
            <Text fw={500} size="sm" lineClamp={1}>
              {attendance.studentName}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {displayStudentId(attendance.studentIdNumber, attendance.studentId)}
            </Text>
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          {statusButtons.map((btn) => (
            (() => {
              const isSelected = attendance.status === btn.value;
              return (
            <Button
              key={btn.value}
              size="xs"
              variant="outline"
              onClick={() => handleStatusChange(btn.value)}
              title={btn.value.charAt(0).toUpperCase() + btn.value.slice(1)}
              aria-pressed={isSelected}
              styles={{
                root: {
                  minWidth: '32px',
                  padding: '0 8px',
                  borderColor: isSelected ? selectedBorderColour : btn.color,
                  borderWidth: isSelected ? '3px' : '1px',
                  boxShadow: isSelected ? `0 0 0 2px ${selectedBorderColour}` : undefined,
                  ...(isSelected
                    ? {
                        backgroundColor: btn.color,
                        color: 'var(--mantine-color-white)',
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: btn.color,
                      }),
                },
              }}
            >
              {btn.label}
            </Button>
              );
            })()
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <TextInput
          type="time"
          value={entryTime}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setEntryTime(value);
            onTimeChange('entryTime', value);
          }}
          disabled={attendance.status === 'absent'}
          size="xs"
          style={{ width: '100px' }}
        />
      </Table.Td>
      <Table.Td>
        <TextInput
          type="time"
          value={exitTime}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setExitTime(value);
            onTimeChange('exitTime', value);
          }}
          size="xs"
          style={{ width: '100px' }}
        />
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Popover width={300} position="bottom" withArrow shadow="md">
            <Popover.Target>
              <ActionIcon
                variant={notes ? 'light' : 'subtle'}
                color={notes ? notifyColors.primary : 'gray'}
                size="sm"
                title={notes || t('addNotes')}
              >
                <IconNotes size={16} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Textarea
                label={t('notes')}
                placeholder={t('notesPlaceholder')}
                value={notes}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setNotes(value);
                  onNotesChange(value);
                }}
                minRows={3}
                autosize
                maxRows={6}
              />
            </Popover.Dropdown>
          </Popover>
          {notes && (
            <Text size="xs" c="dimmed" style={{ maxWidth: '200px' }} lineClamp={1} title={notes}>
              {notes}
            </Text>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

