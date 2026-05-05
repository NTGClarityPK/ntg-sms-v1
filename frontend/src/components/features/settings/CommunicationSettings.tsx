'use client';

import { Alert, Button, Checkbox, Group, Paper, Stack, Switch, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type Direction = 'both' | 'teacher_only';

interface CommunicationDirectionValue {
  teacher_student: Direction;
  teacher_parent: Direction;
}

const DEFAULT_VALUE: CommunicationDirectionValue = {
  teacher_student: 'both',
  teacher_parent: 'both',
};

type CommunicationBranchBroadcastValue = {
  allow_admin_assistant: boolean;
  allow_principal: boolean;
};

const DEFAULT_BRANCH_BROADCAST: CommunicationBranchBroadcastValue = {
  allow_admin_assistant: false,
  allow_principal: false,
};

export function CommunicationSettings() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { user } = useAuth();

  const currentBranchId = user?.currentBranch?.id;
  const isSchoolAdminOnBranch = useMemo(() => {
    if (!currentBranchId || !user?.roles?.length) return false;
    return user.roles.some(
      (r) => r.branchId === currentBranchId && (r.roleName ?? '').toLowerCase() === 'school_admin',
    );
  }, [user?.roles, currentBranchId]);

  const settingQuery = useSystemSetting<CommunicationDirectionValue>('communication_direction');
  const updateMutation = useUpdateSystemSetting<CommunicationDirectionValue>('communication_direction');

  const branchBroadcastQuery = useSystemSetting<CommunicationBranchBroadcastValue>('communication_branch_broadcast');
  const branchBroadcastUpdate = useUpdateSystemSetting<CommunicationBranchBroadcastValue>(
    'communication_branch_broadcast',
  );

  const [value, setValue] = useState<CommunicationDirectionValue | null>(null);
  const [branchBroadcast, setBranchBroadcast] = useState<CommunicationBranchBroadcastValue | null>(null);

  useEffect(() => {
    const remote = settingQuery.data?.data?.value;
    const nextValue: CommunicationDirectionValue =
      remote && typeof remote === 'object'
        ? {
            teacher_student: remote.teacher_student ?? DEFAULT_VALUE.teacher_student,
            teacher_parent: remote.teacher_parent ?? DEFAULT_VALUE.teacher_parent,
          }
        : DEFAULT_VALUE;

    setValue((prev) => {
      if (!prev) return nextValue;
      const isSame =
        prev.teacher_student === nextValue.teacher_student &&
        prev.teacher_parent === nextValue.teacher_parent;
      return isSame ? prev : nextValue;
    });
  }, [settingQuery.data?.data?.value]);

  useEffect(() => {
    const remote = branchBroadcastQuery.data?.data?.value;
    const next: CommunicationBranchBroadcastValue =
      remote && typeof remote === 'object' && !Array.isArray(remote)
        ? {
            allow_admin_assistant: Boolean(
              (remote as CommunicationBranchBroadcastValue).allow_admin_assistant,
            ),
            allow_principal: Boolean((remote as CommunicationBranchBroadcastValue).allow_principal),
          }
        : DEFAULT_BRANCH_BROADCAST;

    setBranchBroadcast((prev) => {
      if (!prev) return next;
      const isSame =
        prev.allow_admin_assistant === next.allow_admin_assistant &&
        prev.allow_principal === next.allow_principal;
      return isSame ? prev : next;
    });
  }, [branchBroadcastQuery.data?.data?.value]);

  const onSave = async () => {
    if (!value) return;
    try {
      await updateMutation.mutateAsync(value);
      notifications.show({ title: tCommon('success'), message: tSettings('commSaved'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const onSaveBranchBroadcast = async () => {
    if (!branchBroadcast) return;
    try {
      await branchBroadcastUpdate.mutateAsync(branchBroadcast);
      notifications.show({
        title: tCommon('success'),
        message: tSettings('commBranchBroadcastSaved'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const directionError = settingQuery.error;
  const branchError = branchBroadcastQuery.error;
  const loadError = directionError ?? (isSchoolAdminOnBranch ? branchError : null);

  if (loadError) {
    return (
      <Alert color={colors.error} title={tSettings('commLoadError')}>
        <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
      </Alert>
    );
  }

  if (!value || (isSchoolAdminOnBranch && !branchBroadcast)) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" py="md">
          <Text size="sm" c="dimmed">
            {tSettings('commLoading')}
          </Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>{tSettings('commMessagingDirection')}</Text>

        <Stack gap="sm">
          <Text fw={500}>{tSettings('commTeacherStudent')}</Text>
          <Group gap="md" wrap="wrap">
            <Checkbox
              id="communication-settings-teacher-student-both"
              label={tSettings('commBothWays')}
              checked={value.teacher_student === 'both'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_student: 'both',
                }))
              }
            />
            <Checkbox
              id="communication-settings-teacher-student-teacher-only"
              label={tSettings('commTeacherOnly')}
              checked={value.teacher_student === 'teacher_only'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_student: 'teacher_only',
                }))
              }
            />
          </Group>
        </Stack>

        <Stack gap="sm">
          <Text fw={500}>{tSettings('commTeacherParent')}</Text>
          <Group gap="md" wrap="wrap">
            <Checkbox
              id="communication-settings-teacher-parent-both"
              label={tSettings('commBothWays')}
              checked={value.teacher_parent === 'both'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_parent: 'both',
                }))
              }
            />
            <Checkbox
              id="communication-settings-teacher-parent-teacher-only"
              label={tSettings('commTeacherOnly')}
              checked={value.teacher_parent === 'teacher_only'}
              onChange={() =>
                setValue((prev) => ({
                  ...(prev ?? DEFAULT_VALUE),
                  teacher_parent: 'teacher_only',
                }))
              }
            />
          </Group>
        </Stack>

        <Group justify="flex-end">
          <Button
            id="communication-settings-save"
            variant="light"
            onClick={onSave}
            loading={updateMutation.isPending}
            disabled={settingQuery.isLoading}
          >
            {tCommon('save')}
          </Button>
        </Group>

        {isSchoolAdminOnBranch && branchBroadcast ? (
          <>
            <Text fw={600} mt="md">
              {tSettings('commBranchBroadcastTitle')}
            </Text>
            <Text size="sm" c="dimmed">
              {tSettings('commBranchBroadcastDescription')}
            </Text>
            <Text size="sm" c="dimmed">
              {tSettings('commBranchBroadcastTenantNote')}
            </Text>
            <Stack gap="sm">
              <Switch
                id="communication-settings-branch-broadcast-admin-assistant"
                label={tSettings('commBranchBroadcastAllowAdminAssistant')}
                checked={branchBroadcast.allow_admin_assistant}
                onChange={(e) =>
                  setBranchBroadcast((prev) =>
                    prev
                      ? { ...prev, allow_admin_assistant: e.currentTarget.checked }
                      : DEFAULT_BRANCH_BROADCAST,
                  )
                }
              />
              <Switch
                id="communication-settings-branch-broadcast-principal"
                label={tSettings('commBranchBroadcastAllowPrincipal')}
                checked={branchBroadcast.allow_principal}
                onChange={(e) =>
                  setBranchBroadcast((prev) =>
                    prev ? { ...prev, allow_principal: e.currentTarget.checked } : DEFAULT_BRANCH_BROADCAST,
                  )
                }
              />
            </Stack>
            <Group justify="flex-end">
              <Button
                id="communication-settings-branch-broadcast-save"
                variant="light"
                onClick={onSaveBranchBroadcast}
                loading={branchBroadcastUpdate.isPending}
                disabled={branchBroadcastQuery.isLoading}
              >
                {tSettings('commBranchBroadcastSave')}
              </Button>
            </Group>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}
