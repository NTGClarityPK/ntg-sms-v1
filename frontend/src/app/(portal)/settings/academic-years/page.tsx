'use client';

import { useState } from 'react';
import { Alert, Button, Group, Skeleton, Stack, Text, Title, Checkbox, Modal, Select, Paper } from '@mantine/core';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { AcademicYearForm, type AcademicYearFormValues } from '@/components/features/settings/AcademicYearForm';
import { AcademicYearCard } from '@/components/features/settings/AcademicYearCard';
import { useAcademicYearsList, useActivateAcademicYear, useCreateAcademicYear, useLockAcademicYear, useRolloverAcademicYear } from '@/hooks/useAcademicYears';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import type { AcademicYear } from '@/types/settings';
import axios from 'axios';

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
  const [opened, { open, close }] = useDisclosure(false);

  const listQuery = useAcademicYearsList({ page: 1, limit: 50, search: '' });
  const createMutation = useCreateAcademicYear();
  const activateMutation = useActivateAcademicYear();
  const lockMutation = useLockAcademicYear();
  const rolloverMutation = useRolloverAcademicYear();
  const [lockingYearId, setLockingYearId] = useState<string | null>(null);
  const [activatingYearId, setActivatingYearId] = useState<string | null>(null);

  const [rolloverOpened, rolloverHandlers] = useDisclosure(false);
  const [rolloverSourceYear, setRolloverSourceYear] = useState<AcademicYear | null>(null);
  const [targetYearId, setTargetYearId] = useState<string | null>(null);
  const [carryForward, setCarryForward] = useState({
    teacherAssignments: false,
    timetableSlots: false,
    leaveSettings: true,
  });

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

  const handleLock = async (year: AcademicYear) => {
    // Check if this is the active year
    if (year.isActive) {
      modals.openConfirmModal({
        title: 'Lock Active Academic Year',
        children: (
          <Text size="sm">
            You are about to lock the <strong>active</strong> academic year. This will make it read-only and prevent all modifications.
            <br />
            <br />
            <strong>Warning:</strong> Once locked, this action cannot be undone. If you need to revert this change, please contact Super Admin Support.
          </Text>
        ),
        labels: { confirm: 'Lock Year', cancel: 'Cancel' },
        confirmProps: { color: 'orange' },
        onConfirm: async () => {
          try {
            setLockingYearId(year.id);
            await lockMutation.mutateAsync(year.id);
            notifications.show({ title: 'Success', message: 'Academic year locked', color: notifyColors.success });
          } catch (error) {
            const message = getApiErrorMessage(error);
            notifications.show({ title: 'Error', message, color: notifyColors.error });
          } finally {
            setLockingYearId(null);
          }
        },
      });
    } else {
      // For non-active years, proceed directly
      try {
        setLockingYearId(year.id);
        await lockMutation.mutateAsync(year.id);
        notifications.show({ title: 'Success', message: 'Academic year locked', color: notifyColors.success });
      } catch (error) {
        const message = getApiErrorMessage(error);
        notifications.show({ title: 'Error', message, color: notifyColors.error });
      } finally {
        setLockingYearId(null);
      }
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

      <Modal
        opened={rolloverOpened}
        onClose={rolloverHandlers.close}
        title="Rollover to new academic year"
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm">
            Copy setup from a locked academic year into your current (active) academic year.
            This will be blocked if Promotion & Placement is incomplete for the selected source year.
          </Text>

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

          <Group justify="flex-end">
            <Button variant="default" onClick={rolloverHandlers.close}>
              Cancel
            </Button>
            <Button
              onClick={handleRollover}
              loading={rolloverMutation.isPending}
              disabled={!targetYearId || !rolloverSourceYear}
            >
              Run rollover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}


