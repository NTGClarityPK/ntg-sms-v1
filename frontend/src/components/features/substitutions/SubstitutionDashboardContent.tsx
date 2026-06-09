'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Alert,
  ActionIcon,
  Tooltip,
  Paper,
  Box,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import '@mantine/dates/styles.css';
import { useStaff } from '@/hooks/useStaff';
import { useSubstitutions, useCancelSubstitution } from '@/hooks/useSubstitutions';
import type { AbsenceReason } from '@/types/substitutions';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const REASON_OPTIONS: { value: AbsenceReason; labelKey: string }[] = [
  { value: 'sick_leave', labelKey: 'reasonSickLeave' },
  { value: 'casual_leave', labelKey: 'reasonCasualLeave' },
  { value: 'emergency', labelKey: 'reasonEmergency' },
  { value: 'other', labelKey: 'reasonOther' },
];

export function SubstitutionDashboardContent() {
  const t = useTranslations('substitution');
  const router = useRouter();
  const today = useMemo(() => todayIso(), []);
  const [absentTeacherId, setAbsentTeacherId] = useState<string | null>(null);
  const [absenceReason, setAbsenceReason] = useState<AbsenceReason>('sick_leave');
  const [leaveRange, setLeaveRange] = useState<[Date | null, Date | null]>([new Date(), new Date()]);
  const cancelMutation = useCancelSubstitution();

  const { data: staffData, isLoading: staffLoading } = useStaff({ isActive: true });
  const { data: listResponse, isLoading, error } = useSubstitutions({ date: today, limit: 50 });

  const staffOptions = (staffData?.data ?? []).map((s) => ({
    value: s.id,
    label: s.fullName ?? s.employeeId ?? s.id,
  }));

  const rows = listResponse?.data ?? [];

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('statusPending');
      case 'confirmed':
        return t('statusConfirmed');
      case 'completed':
        return t('statusCompleted');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };

  const navigateToAssign = (start: string, end?: string) => {
    if (!absentTeacherId) return;
    const params = new URLSearchParams({
      teacher: absentTeacherId,
      date: start,
      reason: absenceReason,
    });
    if (end && end !== start) {
      params.set('endDate', end);
    }
    router.push(`/substitution/assign?${params.toString()}`);
  };

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
            <Stack gap="md">
              <Text fw={600}>{t('quickSubstituteTitle')}</Text>
              <Select
                id="substitution-absent-teacher"
                label={t('absentTeacher')}
                placeholder={t('selectAbsentTeacher')}
                data={staffOptions}
                value={absentTeacherId}
                onChange={setAbsentTeacherId}
                searchable
                disabled={staffLoading}
              />
              <Select
                id="substitution-absence-reason"
                label={t('absenceReason')}
                data={REASON_OPTIONS.map((o) => ({
                  value: o.value,
                  label: t(o.labelKey),
                }))}
                value={absenceReason}
                onChange={(v) => setAbsenceReason((v as AbsenceReason) ?? 'sick_leave')}
              />
              <Button
                id="substitution-find-substitute"
                disabled={!absentTeacherId}
                onClick={() => navigateToAssign(today)}
              >
                {t('findSubstitute')}
              </Button>
            </Stack>
          </Card>

          <Card withBorder padding="md" mt="md">
            <Stack gap="md">
              <Text fw={600}>{t('plannedLeaveTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('plannedLeaveHint')}
              </Text>
              <Paper withBorder p="md">
                <Group wrap="wrap" align="flex-end" gap="sm">
                  <Box style={{ minWidth: 0, flex: '1 1 280px' }}>
                    <DatePickerInput
                      id="substitution-leave-range"
                      type="range"
                      label={t('leaveDateRange')}
                      placeholder={t('dateRangePlaceholder')}
                      value={leaveRange}
                      onChange={(v) => {
                        if (!v || (Array.isArray(v) && !v[0] && !v[1])) {
                          setLeaveRange([null, null]);
                        } else {
                          setLeaveRange(v as [Date | null, Date | null]);
                        }
                      }}
                      leftSection={<IconCalendar size={16} />}
                      minDate={new Date()}
                      clearable
                    />
                  </Box>
                  <Button
                    id="substitution-schedule-substitutes"
                    disabled={!absentTeacherId || !leaveRange[0] || !leaveRange[1]}
                    onClick={() => {
                      if (!leaveRange[0] || !leaveRange[1]) return;
                      navigateToAssign(formatIso(leaveRange[0]), formatIso(leaveRange[1]));
                    }}
                  >
                    {t('scheduleSubstitutes')}
                  </Button>
                </Group>
              </Paper>
            </Stack>
          </Card>

          <Card withBorder padding="md" mt="md">
            <Text fw={600} mb="sm">
              {t('todaySubstitutions')}
            </Text>
            {isLoading || !listResponse ? (
              <Skeleton height={120} />
            ) : error ? (
              <Alert color="red">{t('errorLoading')}</Alert>
            ) : rows.length === 0 ? (
              <Text c="dimmed">{t('noSubstitutionsToday')}</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('absentTeacherCol')}</Table.Th>
                    <Table.Th>{t('substituteCol')}</Table.Th>
                    <Table.Th>{t('periodsCol')}</Table.Th>
                    <Table.Th>{t('statusCol')}</Table.Th>
                    <Table.Th>{t('actionsCol')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>{row.absentTeacherName}</Table.Td>
                      <Table.Td>{row.substituteTeacherName}</Table.Td>
                      <Table.Td>
                        {row.periodLabel}
                        {row.className && row.sectionName
                          ? ` — ${row.className} ${row.sectionName}`
                          : ''}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{statusLabel(row.status)}</Badge>
                      </Table.Td>
                      <Table.Td>
                        {row.status !== 'cancelled' ? (
                          <Tooltip label={t('removeSubstitution')}>
                            <ActionIcon
                              id={`substitution-cancel-${row.id}`}
                              variant="subtle"
                              color="red"
                              aria-label={t('removeSubstitution')}
                              loading={
                                cancelMutation.isPending &&
                                cancelMutation.variables === row.id
                              }
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(row.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        ) : null}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
    </Stack>
  );
}
