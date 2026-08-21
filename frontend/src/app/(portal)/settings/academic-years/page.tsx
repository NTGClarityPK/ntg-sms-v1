'use client';

import { useState } from 'react';
import { Alert, Button, Group, Skeleton, Stack, Text, Title, Checkbox, Modal, Select, Paper, ThemeIcon } from '@mantine/core';
import { IconPlus, IconRefresh, IconAlertTriangle } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { AcademicYearForm, type AcademicYearFormValues } from '@/components/features/settings/AcademicYearForm';
import { AcademicYearCard } from '@/components/features/settings/AcademicYearCard';
import { useAcademicYearsList, useActivateAcademicYear, useCreateAcademicYear, useLockAcademicYear, useRolloverAcademicYear } from '@/hooks/useAcademicYears';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import type { AcademicYear } from '@/types/settings';
import axios from 'axios';
import { useTranslations } from 'next-intl';

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { error?: { message?: string | string[] }; message?: string | string[] }
      | undefined;
    const raw = data?.error?.message ?? data?.message;
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'string' && raw.trim().length > 0) return raw;
  }
  return error instanceof Error ? error.message : 'Unknown error';
}

export default function AcademicYearsPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const t = useTranslations('settings');
  const [opened, { open, close }] = useDisclosure(false);

  const listQuery = useAcademicYearsList({ page: 1, limit: 50, search: '' });
  const createMutation = useCreateAcademicYear();
  const activateMutation = useActivateAcademicYear();
  const lockMutation = useLockAcademicYear();
  const rolloverMutation = useRolloverAcademicYear();
  const [lockingYearId, setLockingYearId] = useState<string | null>(null);
  const [activatingYearId, setActivatingYearId] = useState<string | null>(null);

  // Lock danger-zone modal
  const [lockModalOpened, lockModalHandlers] = useDisclosure(false);
  const [lockTargetYear, setLockTargetYear] = useState<AcademicYear | null>(null);
  const [lockChecks, setLockChecks] = useState({ exams: false, results: false, promotion: false });

  // Rollover modal
  const [rolloverOpened, rolloverHandlers] = useDisclosure(false);
  const [rolloverSourceYear, setRolloverSourceYear] = useState<AcademicYear | null>(null);
  const [targetYearId, setTargetYearId] = useState<string | null>(null);
  const [carryForward, setCarryForward] = useState({
    teacherAssignments: false,
    timetableSlots: false,
    leaveSettings: true,
  });
  const [rolloverChecks, setRolloverChecks] = useState({ exams: false, results: false, promotion: false });

  const handleCreate = async (values: AcademicYearFormValues) => {
    await createMutation.mutateAsync(values);
  };

  const handleActivate = async (id: string) => {
    try {
      setActivatingYearId(id);
      await activateMutation.mutateAsync(id);
      notifications.show({ title: 'Success', message: 'Academic year activated', color: notifyColors.success });
    } catch (error) {
      const message = getApiErrorMessage(error);
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    } finally {
      setActivatingYearId(null);
    }
  };

  const handleLock = (year: AcademicYear) => {
    setLockTargetYear(year);
    setLockChecks({ exams: false, results: false, promotion: false });
    lockModalHandlers.open();
  };

  const confirmLock = async () => {
    if (!lockTargetYear) return;
    try {
      setLockingYearId(lockTargetYear.id);
      lockModalHandlers.close();
      await lockMutation.mutateAsync(lockTargetYear.id);
      notifications.show({ title: 'Success', message: t('academicYearLocked'), color: notifyColors.success });
    } catch (error) {
      const message = getApiErrorMessage(error);
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    } finally {
      setLockingYearId(null);
      setLockTargetYear(null);
    }
  };

  const openRollover = (year: AcademicYear) => {
    setRolloverSourceYear(null);
    setTargetYearId(null);
    setCarryForward({
      teacherAssignments: false,
      timetableSlots: false,
      leaveSettings: true,
    });
    setRolloverChecks({ exams: false, results: false, promotion: false });
    setTargetYearId(year.id);
    rolloverHandlers.open();
  };

  const handleRollover = async () => {
    if (!rolloverSourceYear || !targetYearId) return;
    try {
      const res = await rolloverMutation.mutateAsync({
        sourceAcademicYearId: rolloverSourceYear.id,
        targetAcademicYearId: targetYearId,
        carryForward,
      });
      notifications.show({
        title: 'Success',
        message: `Rollover completed. Copied: class sections ${res.data?.classSectionsCopied ?? 0}, teacher assignments ${res.data?.teacherAssignmentsCopied ?? 0}, timetable slots ${res.data?.timetableSlotsCopied ?? 0}, leave settings ${res.data?.leaveSettingsCopied ?? 0}.`,
        color: notifyColors.success,
      });
      rolloverHandlers.close();
    } catch (error) {
      const message = getApiErrorMessage(error) || 'Failed to rollover academic year';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Academic Year</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create
          </Button>
        </Group>
      </div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        <Stack gap="md">
          {listQuery.isLoading ? (
            <Stack gap="md">
              <Skeleton height={40} width="30%" />
              <Skeleton height={200} />
              <Skeleton height={200} />
            </Stack>
          ) : listQuery.error ? (
          <Alert color={colors.error} title="Failed to load academic years">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
                Retry
              </Button>
            </Group>
          </Alert>
        ) : (listQuery.data?.data?.length ?? 0) === 0 ? (
          <Alert color={colors.info} title="No academic years yet">
            <Text size="sm">Create your first academic year to start configuring the system.</Text>
          </Alert>
        ) : (
          <Stack gap="md">
            {listQuery.data?.data.map((year) => (
              <AcademicYearCard
                key={year.id}
                year={year}
                onActivate={handleActivate}
                onLock={handleLock}
                onRollover={openRollover}
                isActivating={activatingYearId === year.id}
                isLocking={lockingYearId === year.id}
              />
            ))}
          </Stack>
        )}
        </Stack>
      </div>

      <AcademicYearForm
        opened={opened}
        onClose={close}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />

      {/* Lock Danger-Zone Modal */}
      <Modal
        opened={lockModalOpened}
        onClose={lockModalHandlers.close}
        title={
          <Group gap="xs">
            <ThemeIcon color="red" variant="light" size="sm">
              <IconAlertTriangle size={14} />
            </ThemeIcon>
            <Text fw={600} c="red">{t('academicYearLockDangerTitle')}</Text>
          </Group>
        }
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">{t('academicYearLockDangerIntro')}</Text>

          <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-red-3)' }}>
            <Stack gap="sm">
              <Checkbox
                id="lock-check-exams"
                label={t('academicYearLockCheck1')}
                checked={lockChecks.exams}
                onChange={(e) => setLockChecks((p) => ({ ...p, exams: e.currentTarget.checked }))}
              />
              <Checkbox
                id="lock-check-results"
                label={t('academicYearLockCheck2')}
                checked={lockChecks.results}
                onChange={(e) => setLockChecks((p) => ({ ...p, results: e.currentTarget.checked }))}
              />
              <Checkbox
                id="lock-check-promotion"
                label={t('academicYearLockCheck3')}
                checked={lockChecks.promotion}
                onChange={(e) => setLockChecks((p) => ({ ...p, promotion: e.currentTarget.checked }))}
              />
            </Stack>
          </Paper>

          <Alert color="red" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm">{t('academicYearLockDangerWarning')}</Text>
          </Alert>

          <Group justify="flex-end">
            <Button variant="default" onClick={lockModalHandlers.close}>
              Cancel
            </Button>
            <Button
              id="lock-confirm-button"
              color="red"
              disabled={!lockChecks.exams || !lockChecks.results || !lockChecks.promotion}
              loading={!!(lockTargetYear && lockingYearId === lockTargetYear.id)}
              onClick={confirmLock}
            >
              {t('academicYearLockConfirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Rollover Danger-Zone Modal */}
      <Modal
        opened={rolloverOpened}
        onClose={rolloverHandlers.close}
        title={
          <Group gap="xs">
            <ThemeIcon color="orange" variant="light" size="sm">
              <IconAlertTriangle size={14} />
            </ThemeIcon>
            <Text fw={600} c="orange">{t('academicYearRolloverDangerTitle')}</Text>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm">{t('academicYearRolloverDangerIntro')}</Text>

          <Paper withBorder p="md" style={{ borderColor: 'var(--mantine-color-orange-3)' }}>
            <Stack gap="sm">
              <Checkbox
                id="rollover-check-exams"
                label={t('academicYearRolloverCheck1')}
                checked={rolloverChecks.exams}
                onChange={(e) => setRolloverChecks((p) => ({ ...p, exams: e.currentTarget.checked }))}
              />
              <Checkbox
                id="rollover-check-results"
                label={t('academicYearRolloverCheck2')}
                checked={rolloverChecks.results}
                onChange={(e) => setRolloverChecks((p) => ({ ...p, results: e.currentTarget.checked }))}
              />
              <Checkbox
                id="rollover-check-promotion"
                label={t('academicYearRolloverCheck3')}
                checked={rolloverChecks.promotion}
                onChange={(e) => setRolloverChecks((p) => ({ ...p, promotion: e.currentTarget.checked }))}
              />
            </Stack>
          </Paper>

          <Select
            label="Source academic year (locked)"
            data={(listQuery.data?.data ?? [])
              .filter((y) => y.isLocked && y.id !== targetYearId)
              .map((y) => ({ value: y.id, label: y.name }))}
            value={rolloverSourceYear?.id ?? null}
            onChange={(v) => {
              const year = (listQuery.data?.data ?? []).find((y) => y.id === v) ?? null;
              setRolloverSourceYear(year);
            }}
            placeholder="Select locked source year"
            searchable
          />

          <Paper withBorder p="md">
            <Stack gap="xs">
              <Checkbox
                label="Copy teacher assignments"
                checked={carryForward.teacherAssignments}
                onChange={(e) => setCarryForward((p) => ({ ...p, teacherAssignments: e.currentTarget.checked }))}
              />
              <Checkbox
                label="Copy timetable slots"
                checked={carryForward.timetableSlots}
                onChange={(e) => setCarryForward((p) => ({ ...p, timetableSlots: e.currentTarget.checked }))}
              />
              <Checkbox
                label="Copy leave settings"
                checked={carryForward.leaveSettings}
                onChange={(e) => setCarryForward((p) => ({ ...p, leaveSettings: e.currentTarget.checked }))}
              />
            </Stack>
          </Paper>

          <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm">{t('academicYearRolloverDangerWarning')}</Text>
          </Alert>

          <Group justify="flex-end">
            <Button variant="default" onClick={rolloverHandlers.close}>
              Cancel
            </Button>
            <Button
              id="rollover-confirm-button"
              color="orange"
              onClick={handleRollover}
              loading={rolloverMutation.isPending}
              disabled={!targetYearId || !rolloverSourceYear || !rolloverChecks.exams || !rolloverChecks.results || !rolloverChecks.promotion}
            >
              Run rollover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}


