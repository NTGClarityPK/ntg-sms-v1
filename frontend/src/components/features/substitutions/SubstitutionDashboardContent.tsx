'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  Alert,
  ActionIcon,
  Tooltip,
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

  const [quickTeacherId, setQuickTeacherId] = useState<string | null>(null);
  const [quickReason, setQuickReason] = useState<AbsenceReason>('sick_leave');

  const [plannedTeacherId, setPlannedTeacherId] = useState<string | null>(null);
  const [plannedReason, setPlannedReason] = useState<AbsenceReason>('sick_leave');
  const [leaveRange, setLeaveRange] = useState<[Date | null, Date | null]>([new Date(), new Date()]);

  const cancelMutation = useCancelSubstitution();

  const { data: staffData, isLoading: staffLoading } = useStaff({ isActive: true });
  const { data: listResponse, isLoading, error } = useSubstitutions({ date: today, limit: 50 });

  const staffOptions = (staffData?.data ?? []).map((s) => ({
    value: s.id,
    label: s.fullName ?? s.employeeId ?? s.id,
  }));

  const reasonSelectData = REASON_OPTIONS.map((o) => ({
    value: o.value,
    label: t(o.labelKey),
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

  const navigateToAssign = (
    teacherId: string,
    reason: AbsenceReason,
    start: string,
    end?: string,
  ) => {
    const params = new URLSearchParams({
      teacher: teacherId,
      date: start,
      reason,
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
          <div>
            <Text fw={600}>{t('quickSubstituteTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('quickSubstituteHint')}
            </Text>
          </div>
          <Select
            id="substitution-absent-teacher"
            label={t('absentTeacher')}
            placeholder={t('selectAbsentTeacher')}
            data={staffOptions}
            value={quickTeacherId}
            onChange={setQuickTeacherId}
            searchable
            disabled={staffLoading}
          />
          <Select
            id="substitution-absence-reason"
            label={t('absenceReason')}
            data={reasonSelectData}
            value={quickReason}
            onChange={(v) => setQuickReason((v as AbsenceReason) ?? 'sick_leave')}
          />
          <Button
            id="substitution-find-substitute"
            disabled={!quickTeacherId}
            onClick={() => {
              if (!quickTeacherId) return;
              navigateToAssign(quickTeacherId, quickReason, today);
            }}
          >
            {t('findSubstitute')}
          </Button>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="md">
          <div>
            <Text fw={600}>{t('plannedLeaveTitle')}</Text>
            <Text size="sm" c="dimmed">
              {t('plannedLeaveHint')}
            </Text>
          </div>
          <Select
            id="substitution-planned-absent-teacher"
            label={t('absentTeacher')}
            placeholder={t('selectAbsentTeacher')}
            data={staffOptions}
            value={plannedTeacherId}
            onChange={setPlannedTeacherId}
            searchable
            disabled={staffLoading}
          />
          <Select
            id="substitution-planned-absence-reason"
            label={t('absenceReason')}
            data={reasonSelectData}
            value={plannedReason}
            onChange={(v) => setPlannedReason((v as AbsenceReason) ?? 'sick_leave')}
          />
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
          <Button
            id="substitution-schedule-substitutes"
            disabled={!plannedTeacherId || !leaveRange[0] || !leaveRange[1]}
            onClick={() => {
              if (!plannedTeacherId || !leaveRange[0] || !leaveRange[1]) return;
              navigateToAssign(
                plannedTeacherId,
                plannedReason,
                formatIso(leaveRange[0]),
                formatIso(leaveRange[1]),
              );
            }}
          >
            {t('scheduleSubstitutes')}
          </Button>
        </Stack>
      </Card>

      <Card withBorder padding="md">
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
