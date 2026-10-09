'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconDeviceFloppy, IconSearch } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import type { Attendance } from '@/types/attendance';
import { StudentRow } from './StudentRow';
import { SyncStatusBar } from './SyncStatusBar';
import { useBulkMarkAttendance } from '@/hooks/useAttendance';
import type {
  AttendanceSyncState,
  PersistMarkInput,
} from '@/hooks/useOfflineAttendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { upsertOutbox } from '@/lib/offline/attendance-outbox';

interface AttendanceSheetProps {
  classSectionId: string;
  date: string;
  attendance: Attendance[];
  isLoading: boolean;
  className: string;
  sectionName: string;
  isOnline: boolean;
  dbAvailable: boolean;
  syncState: AttendanceSyncState;
  errorStudentIds: Set<string>;
  isFlushing: boolean;
  persistMark: (input: PersistMarkInput) => Promise<boolean>;
  flush: () => Promise<{ synced: number; failed: number }>;
  retryFailed: () => Promise<{ synced: number; failed: number }>;
}

export function AttendanceSheet({
  classSectionId,
  date,
  attendance,
  isLoading,
  className,
  sectionName,
  isOnline,
  dbAvailable,
  syncState,
  errorStudentIds,
  isFlushing,
  persistMark,
  flush,
  retryFailed,
}: AttendanceSheetProps) {
  const t = useTranslations('attendance');
  const [localAttendance, setLocalAttendance] = useState<Attendance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchQuery, 300);
  const [bulkEntryTime, setBulkEntryTime] = useState('');
  const [bulkExitTime, setBulkExitTime] = useState('');
  const [applyEntryToAll, setApplyEntryToAll] = useState(true);
  const [applyExitToAll, setApplyExitToAll] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    setLocalAttendance(attendance);
  }, [attendance]);

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

  const queueMark = useCallback(
    (row: Attendance) => {
      void persistMark({
        studentId: row.studentId,
        status: row.status,
        entryTime: row.entryTime ?? null,
        exitTime: row.exitTime ?? null,
        notes: row.notes ?? null,
      });
    },
    [persistMark],
  );

  const handleStatusChange = (studentId: string, status: Attendance['status']) => {
    setLocalAttendance((prev) => {
      const next = prev.map((a) => {
        if (a.studentId !== studentId) return a;
        if (status === 'present' || status === 'late') {
          return {
            ...a,
            status,
            entryTime: new Date().toTimeString().slice(0, 5),
          };
        }
        return { ...a, status, entryTime: undefined, exitTime: undefined };
      });
      const updated = next.find((a) => a.studentId === studentId);
      if (updated) queueMark(updated);
      return next;
    });
  };

  const persistMany = useCallback(
    (rows: Attendance[]) => {
      for (const row of rows) {
        void persistMark({
          studentId: row.studentId,
          status: row.status,
          entryTime: row.entryTime ?? null,
          exitTime: row.exitTime ?? null,
          notes: row.notes ?? null,
        });
      }
    },
    [persistMark],
  );

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
    setLocalAttendance((prev) => {
      const next = prev.map((a) =>
        targetIds.has(a.studentId) ? { ...a, entryTime: bulkEntryTime } : a,
      );
      persistMany(next.filter((a) => targetIds.has(a.studentId)));
      return next;
    });
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
    setLocalAttendance((prev) => {
      const next = prev.map((a) =>
        targetIds.has(a.studentId) ? { ...a, exitTime: bulkExitTime } : a,
      );
      persistMany(next.filter((a) => targetIds.has(a.studentId)));
      return next;
    });
  };

  const handleTimeChange = (
    studentId: string,
    field: 'entryTime' | 'exitTime',
    value: string,
  ) => {
    setLocalAttendance((prev) => {
      const next = prev.map((a) =>
        a.studentId === studentId ? { ...a, [field]: value } : a,
      );
      const updated = next.find((a) => a.studentId === studentId);
      if (updated) queueMark(updated);
      return next;
    });
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setLocalAttendance((prev) => {
      const next = prev.map((a) => (a.studentId === studentId ? { ...a, notes } : a));
      const updated = next.find((a) => a.studentId === studentId);
      if (updated) queueMark(updated);
      return next;
    });
  };

  const handleSave = async () => {
    if (isSaving || bulkMarkMutation.isPending || isFlushing) return;
    setIsSaving(true);
    try {
      // Ensure full sheet is in the outbox before flush / online fallback
      if (dbAvailable) {
        await Promise.all(
          localAttendance.map((a) =>
            upsertOutbox({
              classSectionId,
              date,
              studentId: a.studentId,
              status: a.status,
              entryTime: a.entryTime ?? null,
              exitTime: a.exitTime ?? null,
              notes: a.notes ?? null,
            }),
          ),
        );
      }

      if (!isOnline) {
        notifications.show({
          title: t('savedLocallyTitle'),
          message: t('savedLocallyMessage'),
          color: notifyColors.warning,
        });
        return;
      }

      if (!dbAvailable) {
        // Degraded path: classic online-only bulk save
        await bulkMarkMutation.mutateAsync({
          classSectionId,
          date,
          records: localAttendance.map((a) => ({
            studentId: a.studentId,
            status: a.status,
            entryTime: a.entryTime,
            exitTime: a.exitTime,
            notes: a.notes,
          })),
        });
        return;
      }

      const result = await flush();
      if (result.failed > 0) {
        notifications.show({
          title: t('syncPartialTitle'),
          message: t('syncPartialMessage', {
            synced: result.synced,
            failed: result.failed,
          }),
          color: notifyColors.warning,
        });
      } else {
        notifications.show({
          title: t('saveSuccessTitle'),
          message: t('saveSuccessMessage'),
          color: notifyColors.success,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveBusy = isSaving || isFlushing || bulkMarkMutation.isPending;

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
        <SyncStatusBar
          isOnline={isOnline}
          syncState={syncState}
          isFlushing={isFlushing}
          onRetry={() => {
            void retryFailed();
          }}
          dbAvailable={dbAvailable}
        />

        <Group justify="space-between" mb="md">
          <Text fw={500} size="lg">
            {className} - {sectionName}
          </Text>
          <Button
            id="attendance-save"
            leftSection={<IconDeviceFloppy size={18} />}
            onClick={() => {
              void handleSave();
            }}
            loading={!isLoading && saveBusy}
            disabled={isLoading}
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
                  id="attendance-bulk-entry-time"
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
                    id="attendance-bulk-entry-apply-all"
                    checked={applyEntryToAll}
                    onChange={(e) => setApplyEntryToAll(e.currentTarget.checked)}
                    label={t('bulkApplyToAll')}
                  />
                  <Button
                    id="attendance-bulk-apply-entry"
                    size="xs"
                    variant="light"
                    onClick={applyBulkEntry}
                  >
                    {t('bulkApplyEntry')}
                  </Button>
                </Group>
              </Stack>
              <Stack gap="xs">
                <TextInput
                  id="attendance-bulk-exit-time"
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
                    id="attendance-bulk-exit-apply-all"
                    checked={applyExitToAll}
                    onChange={(e) => setApplyExitToAll(e.currentTarget.checked)}
                    label={t('bulkApplyToAll')}
                  />
                  <Button
                    id="attendance-bulk-apply-exit"
                    size="xs"
                    variant="light"
                    onClick={applyBulkExit}
                  >
                    {t('bulkApplyExit')}
                  </Button>
                </Group>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Paper>

        <Divider />

        <TextInput
          id="attendance-student-search"
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
                    syncError={errorStudentIds.has(record.studentId)}
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
