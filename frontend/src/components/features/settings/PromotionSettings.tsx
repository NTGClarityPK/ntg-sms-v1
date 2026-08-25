'use client';

import { useState, useEffect } from 'react';
import { Alert, NumberInput, Stack, Switch, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';

export function PromotionSettings() {
  const notifyColors = useNotificationColors();

  const enabledQuery = useSystemSetting<boolean>('promotion_module_enabled');
  const windowDaysQuery = useSystemSetting<number>('promotion_window_days');
  const manualOpenQuery = useSystemSetting<boolean>('promotion_window_manual_open');

  const updateEnabled = useUpdateSystemSetting<boolean>('promotion_module_enabled');
  const updateWindowDays = useUpdateSystemSetting<number>('promotion_window_days');
  const updateManualOpen = useUpdateSystemSetting<boolean>('promotion_window_manual_open');

  const enabled = enabledQuery.data?.data?.value ?? true;
  const windowDays = windowDaysQuery.data?.data?.value ?? 45;
  const manualOpen = manualOpenQuery.data?.data?.value ?? false;

  const [daysValue, setDaysValue] = useState<number | string>(windowDays);
  useEffect(() => {
    setDaysValue(windowDays);
  }, [windowDays]);

  const handleToggleEnabled = async (val: boolean) => {
    try {
      await updateEnabled.mutateAsync(val);
      notifications.show({
        title: 'Saved',
        message: val ? 'Promotion & Placement module enabled.' : 'Promotion & Placement module disabled.',
        color: notifyColors.success,
      });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update setting.', color: notifyColors.error });
    }
  };

  const handleToggleManualOpen = async (val: boolean) => {
    try {
      await updateManualOpen.mutateAsync(val);
      notifications.show({
        title: 'Saved',
        message: val ? 'Promotion window force-opened.' : 'Manual override removed.',
        color: notifyColors.success,
      });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update setting.', color: notifyColors.error });
    }
  };

  const handleDaysBlur = async () => {
    const parsed = typeof daysValue === 'number' ? daysValue : parseInt(String(daysValue), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    try {
      await updateWindowDays.mutateAsync(parsed);
      notifications.show({ title: 'Saved', message: 'Promotion window days updated.', color: notifyColors.success });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to update setting.', color: notifyColors.error });
    }
  };

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>Promotion &amp; Placement</Title>
        <Text size="sm" c="dimmed">
          Control when and who can record year-end promotion decisions for students.
        </Text>
      </Stack>

      <Stack gap="md">
        <Switch
          id="promotion-module-enabled"
          label="Enable Promotion & Placement module"
          description="When off, the Promotions tab is hidden for all users and saving decisions is blocked."
          checked={enabled}
          onChange={(e) => handleToggleEnabled(e.currentTarget.checked)}
          disabled={updateEnabled.isPending}
        />

        <NumberInput
          id="promotion-window-days"
          label="Days before year end to open window"
          description="How many days before the academic year end date to allow saving promotion decisions. Default: 45 days."
          value={daysValue}
          onChange={setDaysValue}
          onBlur={handleDaysBlur}
          min={1}
          max={365}
          disabled={!enabled || updateWindowDays.isPending}
          style={{ maxWidth: 240 }}
        />

        <Switch
          id="promotion-window-manual-open"
          label="Force-open promotion window now"
          description="Override the date check and allow saving decisions immediately, regardless of the window days setting."
          checked={manualOpen}
          onChange={(e) => handleToggleManualOpen(e.currentTarget.checked)}
          disabled={!enabled || updateManualOpen.isPending}
        />

        {manualOpen && (
          <Alert color="orange" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm">
              The promotion window is manually forced open. Any admin with Promotion access can save decisions right now.
              Turn this off once the promotion period ends.
            </Text>
          </Alert>
        )}
      </Stack>
    </Stack>
  );
}
