'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  List,
  Paper,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import {
  useAssignSubstitutions,
  useSuggestSubstitutions,
} from '@/hooks/useSubstitutions';
import type { AbsenceReason, SuggestedSubstitute } from '@/types/substitutions';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function SubstituteRow({
  candidate,
  selectedId,
  onSelect,
  onAssignNow,
  assigning,
  t,
  colors,
}: {
  candidate: SuggestedSubstitute;
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  onAssignNow: (id: string) => void;
  assigning: boolean;
  t: ReturnType<typeof useTranslations<'substitution'>>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const availabilityColor =
    candidate.availabilityStatus === 'available'
      ? colors.success
      : candidate.availabilityStatus === 'partial'
        ? 'yellow'
        : colors.error;

  const isSelected = selectedId === candidate.staffId;

  return (
    <Paper
      withBorder
      p="md"
      key={candidate.staffId}
      style={
        isSelected
          ? { borderWidth: 2, borderColor: colors.primary }
          : undefined
      }
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={600}>{candidate.fullName}</Text>
            {candidate.isBestMatch ? (
              <Badge color={colors.success} variant="filled">
                {t('bestMatch')}
              </Badge>
            ) : null}
            {candidate.hasHighLoadWarning ? (
              <Badge color="orange" variant="light">
                {t('highLoadWarning')}
              </Badge>
            ) : null}
          </Group>
          {candidate.primarySubject ? (
            <Text size="sm" c="dimmed">
              {candidate.primarySubject}
            </Text>
          ) : null}
          <Text size="sm">
            {t('freePeriods', {
              free: candidate.freePeriods,
              total: candidate.totalAffectedPeriods,
            })}
          </Text>
          <Text size="sm" c="dimmed">
            {t('substitutedThisMonth', { count: candidate.substitutionsThisMonth })}
          </Text>
          <Badge color={availabilityColor} variant="light" size="sm">
            {candidate.availabilityStatus === 'available'
              ? t('availabilityAvailable')
              : candidate.availabilityStatus === 'partial'
                ? t('availabilityPartial')
                : t('availabilityUnavailable')}
          </Badge>
        </Stack>
        <Stack gap="xs">
          <Button
            id={`substitution-select-${candidate.staffId}`}
            variant={isSelected ? 'filled' : 'light'}
            onClick={() => onSelect(candidate.staffId, candidate.fullName)}
          >
            {isSelected ? t('substituteSelected') : t('selectSubstitute')}
          </Button>
          <Button
            id={`substitution-assign-now-${candidate.staffId}`}
            variant="filled"
            loading={assigning && isSelected}
            disabled={assigning}
            onClick={() => onAssignNow(candidate.staffId)}
          >
            {t('assignAndNotify')}
          </Button>
        </Stack>
      </Group>
    </Paper>
  );
}

export function SubstitutionAssignContent() {
  const t = useTranslations('substitution');
  const colors = useThemeColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teacherId = searchParams?.get('teacher') ?? null;
  const date = searchParams?.get('date') ?? null;
  const endDate = searchParams?.get('endDate') ?? undefined;
  const reason = (searchParams?.get('reason') as AbsenceReason) ?? 'sick_leave';

  const suggestMutation = useSuggestSubstitutions();
  const assignMutation = useAssignSubstitutions();
  const [selectedSubstituteId, setSelectedSubstituteId] = useState<string | null>(null);
  const [selectedSubstituteName, setSelectedSubstituteName] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);
  const confirmBarRef = useRef<HTMLDivElement>(null);

  const handleSelectSubstitute = useCallback(
    (id: string, name: string) => {
      setSelectedSubstituteId(id);
      setSelectedSubstituteName(name);
      notifications.show({
        title: t('substituteSelectedTitle'),
        message: t('substituteSelectedToast', { name }),
        color: colors.primary,
      });
      requestAnimationFrame(() => {
        confirmBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [t, colors.primary],
  );

  useEffect(() => {
    if (!teacherId || !date) return;
    suggestMutation.mutate({
      absentTeacherId: teacherId,
      date,
      endDate: endDate && endDate !== date ? endDate : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per teacher/date range
  }, [teacherId, date, endDate]);

  const result = suggestMutation.data;
  const slotIds = useMemo(
    () => (result?.affectedSlots ?? []).map((s) => s.id),
    [result?.affectedSlots],
  );

  const dateRangeLabel =
    endDate && endDate !== date ? `${date} → ${endDate}` : date ?? '';

  const runAssign = (substituteId: string) => {
    if (!teacherId || !date || slotIds.length === 0) {
      notifications.show({
        title: t('assignFailedTitle'),
        message:
          slotIds.length === 0 ? t('noAffectedSlots') : t('selectSubstituteFirst'),
        color: colors.error,
      });
      return;
    }
    setSelectedSubstituteId(substituteId);
    assignMutation.mutate(
      {
        absentTeacherId: teacherId,
        substituteTeacherId: substituteId,
        date,
        endDate: endDate && endDate !== date ? endDate : undefined,
        timetableSlotIds: slotIds,
        absenceReason: reason,
      },
      {
        onSuccess: () => router.push('/substitution'),
      },
    );
  };

  if (!teacherId || !date) {
    return (
      <Alert color="red" id="substitution-assign-missing-params">
        {t('missingParams')}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Button
        id="substitution-assign-back"
        variant="subtle"
        onClick={() => router.push('/substitution')}
      >
        {t('backToDashboard')}
      </Button>

      {suggestMutation.isPending ? (
        <Skeleton height={200} />
      ) : suggestMutation.isError ? (
        <Alert color="red">{suggestMutation.error.message}</Alert>
      ) : result ? (
        <>
          <Card withBorder padding="md">
            <Stack gap="xs">
              <Title order={4}>{t('absentTeacherInfo')}</Title>
              <Text fw={600}>{result.absentTeacherName}</Text>
              <Text size="sm" c="dimmed">
                {t('dateRangeLabel')}: {dateRangeLabel}
              </Text>
              {result.totalPeriodAssignments > 0 ? (
                <Text size="sm">
                  {t('totalAssignments', { count: result.totalPeriodAssignments })}
                </Text>
              ) : null}
            </Stack>
          </Card>

          <Card withBorder padding="md">
            <Text fw={600} mb="sm">
              {t('affectedPeriods')}
            </Text>
            {result.affectedSlots.length === 0 ? (
              <Text c="dimmed">{t('noSuggestions')}</Text>
            ) : (
              <List size="sm">
                {result.affectedSlots.map((slot) => (
                  <List.Item key={slot.id}>
                    {DAY_NAMES[slot.dayOfWeek] ?? slot.dayOfWeek}:{' '}
                    {slot.periodNumber != null
                      ? `Period ${slot.periodNumber}`
                      : `${slot.startTime}–${slot.endTime}`}
                    {' — '}
                    {slot.className} {slot.sectionName}
                    {slot.subjectName ? ` (${slot.subjectName})` : ''}
                  </List.Item>
                ))}
              </List>
            )}
          </Card>

          <Text fw={600}>{t('suggestedSubstitutes')}</Text>
          <Text size="sm" c="dimmed">
            {t('assignHint')}
          </Text>
          {result.suggested.length === 0 && result.others.length === 0 ? (
            <Alert color="yellow">{t('noSuggestions')}</Alert>
          ) : (
            <Stack gap="sm">
              {result.suggested.map((c) => (
                <SubstituteRow
                  key={c.staffId}
                  candidate={c}
                  selectedId={selectedSubstituteId}
                  onSelect={handleSelectSubstitute}
                  onAssignNow={runAssign}
                  assigning={assignMutation.isPending}
                  t={t}
                  colors={colors}
                />
              ))}
            </Stack>
          )}

          {result.others.length > 0 ? (
            <>
              <Button
                id="substitution-toggle-others"
                variant="subtle"
                onClick={() => setOthersOpen((o) => !o)}
              >
                {t('otherAvailableTeachers')}
              </Button>
              <Collapse in={othersOpen}>
                <Stack gap="sm">
                  {result.others.map((c) => (
                    <SubstituteRow
                      key={c.staffId}
                      candidate={c}
                      selectedId={selectedSubstituteId}
                      onSelect={handleSelectSubstitute}
                      onAssignNow={runAssign}
                      assigning={assignMutation.isPending}
                      t={t}
                      colors={colors}
                    />
                  ))}
                </Stack>
              </Collapse>
            </>
          ) : null}

          {selectedSubstituteId ? (
            <Paper
              ref={confirmBarRef}
              withBorder
              p="md"
              mt="md"
              id="substitution-confirm-bar"
            >
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Text fw={600}>
                  {t('confirmSubstituteLabel', {
                    name: selectedSubstituteName ?? selectedSubstituteId,
                  })}
                </Text>
                <Button
                  id="substitution-notify-confirm"
                  disabled={slotIds.length === 0 || assignMutation.isPending}
                  loading={assignMutation.isPending}
                  onClick={() => runAssign(selectedSubstituteId)}
                >
                  {t('notifyAndConfirm')}
                </Button>
              </Group>
            </Paper>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
