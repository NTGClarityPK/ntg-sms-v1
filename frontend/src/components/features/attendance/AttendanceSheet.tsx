'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
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
  Checkbox,
  Divider,
  SimpleGrid,
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
  const t = useTranslations('attendance');
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [bulkEntryTime, setBulkEntryTime] = useState('');
  const [bulkExitTime, setBulkExitTime] = useState('');
  const [applyEntryToAll, setApplyEntryToAll] = useState(true);
  const [applyExitToAll, setApplyExitToAll] = useState(true);
  const bulkMarkMutation = useBulkMarkAttendance();
  const notifyColors = useThemeColors();

  const markingDateLabel = useMemo(() => {
    const parts = date.split('-').map((p) => Number(p));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return date;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [date]);

  const markingClassSectionLabel = useMemo(() => {
    const left = (className || '').trim();
    const right = (sectionName || '').trim();
    if (!left && !right) return '—';
    if (!left) return right;
    if (!right) return left;
    return `${left} — ${right}`;
  }, [className, sectionName]);

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
      prev.map((a) => {
        if (a.studentId !== studentId) return a;
        if (status === 'present' || status === 'late') {
          return {
            ...a,
            status,
            entryTime: new Date().toTimeString().slice(0, 5),
          };
        }
        return { ...a, status, entryTime: undefined, exitTime: undefined };
      }),
    );
  };

  const applyBulkEntry = () => {
    if (!bulkEntryTime.trim()) return;
    const targetIds = new Set(
      applyEntryToAll
        ? localAttendance
            .filter((a) => a.status === 'present' || a.status === 'late')
            .map((a) => a.studentId)
        : filteredAttendance
            .filter((a) => a.status === 'present' || a.status === 'late')
            .map((a) => a.studentId),
    );
    if (targetIds.size === 0) return;
    setLocalAttendance((prev) =>
      prev.map((a) => (targetIds.has(a.studentId) ? { ...a, entryTime: bulkEntryTime } : a)),
    );
  };

  const applyBulkExit = () => {
    if (!bulkExitTime.trim()) return;
    const targetIds = new Set(
      applyExitToAll
        ? localAttendance
            .filter((a) => a.status === 'present' || a.status === 'late')
            .map((a) => a.studentId)
        : filteredAttendance
            .filter((a) => a.status === 'present' || a.status === 'late')
            .map((a) => a.studentId),
    );
    if (targetIds.size === 0) return;
    setLocalAttendance((prev) =>
      prev.map((a) => (targetIds.has(a.studentId) ? { ...a, exitTime: bulkExitTime } : a)),
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
          {t('noStudentsInClassSection')}
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
            {t('saveAttendance')}
          </Button>
        </Group>

        <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-default-hover)">
          <Stack gap="sm">
            <div>
              <Text fw={600} size="sm">
                {t('bulkTimeEntryTitle')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('bulkTimeEntryHint')}
              </Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack gap="xs">
                <TextInput
                  type="time"
                  label={t('entryTime')}
                  value={bulkEntryTime}
                  onChange={(e) => setBulkEntryTime(e.currentTarget.value)}
                  styles={{
                    input: { minWidth: 96 },
                  }}
                />
                <Group gap="sm" wrap="nowrap" align="center">
                  <Checkbox
                    checked={applyEntryToAll}
                    onChange={(e) => setApplyEntryToAll(e.currentTarget.checked)}
                    label={t('bulkApplyToAll')}
                  />
                  <Button size="xs" variant="light" onClick={applyBulkEntry}>
                    {t('bulkApplyEntry')}
                  </Button>
                </Group>
              </Stack>
              <Stack gap="xs">
                <TextInput
                  type="time"
                  label={t('exitTime')}
                  value={bulkExitTime}
                  onChange={(e) => setBulkExitTime(e.currentTarget.value)}
                  styles={{
                    input: { minWidth: 96 },
                  }}
                />
                <Group gap="sm" wrap="nowrap" align="center">
                  <Checkbox
                    checked={applyExitToAll}
                    onChange={(e) => setApplyExitToAll(e.currentTarget.checked)}
                    label={t('bulkApplyToAll')}
                  />
                  <Button size="xs" variant="light" onClick={applyBulkExit}>
                    {t('bulkApplyExit')}
                  </Button>
                </Group>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Paper>

        <Divider />

        <TextInput
          placeholder={t('searchByStudentNameOrId')}
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
        />
        <Text size="sm" c="dimmed" mb="md">
          {t('markingForLabel', {
            classSection: markingClassSectionLabel,
            date: markingDateLabel,
          })}
        </Text>

        <ScrollArea>
          <Table
            striped
            highlightOnHover
            style={{ tableLayout: 'fixed', width: '100%' }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '26%', verticalAlign: 'middle' }}>{t('student')}</Table.Th>
                <Table.Th style={{ width: '22%', verticalAlign: 'middle' }}>{t('status')}</Table.Th>
                <Table.Th style={{ width: '18%', verticalAlign: 'middle' }}>{t('entryTime')}</Table.Th>
                <Table.Th style={{ width: '18%', verticalAlign: 'middle' }}>{t('exitTime')}</Table.Th>
                <Table.Th style={{ width: '16%', verticalAlign: 'middle', textAlign: 'center' }}>
                  {t('notes')}
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredAttendance.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" size="sm" ta="center" py="md">
                      {debouncedSearch.trim()
                        ? t('noStudentsMatchingSearch')
                        : t('noStudentsFound')}
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



