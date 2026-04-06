'use client';

import { Alert, Button, Checkbox, Group, Paper, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import { useTranslations } from 'next-intl';

interface BehavioralAssessmentValue {
  enabled: boolean;
  mandatory: boolean;
  attributes: string[];
}

const DEFAULT_VALUE: BehavioralAssessmentValue = {
  enabled: false,
  mandatory: false,
  attributes: [],
};

export function BehaviorSettings({ showHeader = true }: { showHeader?: boolean }) {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const settingQuery = useSystemSetting<BehavioralAssessmentValue>('behavioral_assessment');
  const updateMutation = useUpdateSystemSetting<BehavioralAssessmentValue>('behavioral_assessment');

  const [value, setValue] = useState<BehavioralAssessmentValue | null>(null);
  const [newAttr, setNewAttr] = useState('');

  useEffect(() => {
    const remote = settingQuery.data?.data?.value;
    if (!value && remote && typeof remote === 'object') {
      setValue({
        enabled: remote.enabled ?? DEFAULT_VALUE.enabled,
        mandatory: remote.mandatory ?? DEFAULT_VALUE.mandatory,
        attributes: Array.isArray(remote.attributes) ? remote.attributes : DEFAULT_VALUE.attributes,
      });
      return;
    }
    if (!value && !remote) {
      setValue(DEFAULT_VALUE);
    }
  }, [settingQuery.data?.data?.value, value]);

  const attrs = useMemo(
    () => (value?.attributes ?? []).map((a) => a.trim()).filter((a) => a.length > 0),
    [value?.attributes],
  );

  const addAttr = () => {
    if (!value) return;
    const next = newAttr.trim();
    if (!next) return;
    if (attrs.includes(next)) return;
    setValue((prev) => ({
      ...(prev ?? DEFAULT_VALUE),
      attributes: [...attrs, next],
    }));
    setNewAttr('');
  };

  const removeAttr = (name: string) => {
    setValue((prev) => ({
      ...(prev ?? DEFAULT_VALUE),
      attributes: attrs.filter((a) => a !== name),
    }));
  };

  const onSave = async () => {
    if (!value) return;
    try {
      await updateMutation.mutateAsync({ ...value, attributes: attrs });
      notifications.show({ title: tCommon('success'), message: tSettings('behaviorSaved'), color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('behaviorLoadError')}>
        <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
      </Alert>
    );
  }

  if (!value) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" py="md">
          <Text size="sm" c="dimmed">{tSettings('behaviorLoading')}</Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Stack gap="xs">
      {showHeader && (
        <Stack gap={4}>
          <Text size="lg" fw={600}>
            {tSettings('generalBehaviorTitle')}
          </Text>
          <Text size="sm" c="dimmed">
            {tSettings('generalBehaviorDescription')}
          </Text>
        </Stack>
      )}
      <Paper withBorder p="md">
        <Stack gap="md">
          {!showHeader && <Text fw={600}>{tSettings('behaviorTitle')}</Text>}

        <Switch
          id="behavior-settings-enabled"
          label={tSettings('behaviorEnableSwitch')}
          checked={value.enabled}
          onChange={() =>
            setValue((prev) => ({
              ...(prev ?? DEFAULT_VALUE),
              enabled: !(prev ?? DEFAULT_VALUE).enabled,
            }))
          }
        />

        <Checkbox
          id="behavior-settings-mandatory"
          label={tSettings('behaviorMandatory')}
          checked={value.mandatory}
          disabled={!value.enabled}
          onChange={() =>
            setValue((prev) => ({
              ...(prev ?? DEFAULT_VALUE),
              mandatory: !(prev ?? DEFAULT_VALUE).mandatory,
            }))
          }
        />

        <Group align="flex-end">
          <TextInput
            id="behavior-settings-attribute-input"
            label={tSettings('behaviorAddAttributeLabel')}
            placeholder={tSettings('behaviorAddAttributePlaceholder')}
            value={newAttr}
            onChange={(e) => setNewAttr(e.currentTarget.value)}
            disabled={!value.enabled}
          />
          <Button id="behavior-settings-add-attribute" variant="light" onClick={addAttr} disabled={!value.enabled}>
            {tCommon('add')}
          </Button>
        </Group>

        <Stack gap="xs">
          {attrs.length === 0 ? (
            <Text c="dimmed" size="sm">{tSettings('behaviorNoAttributes')}</Text>
          ) : (
            attrs.map((a) => (
              <Group key={a} justify="space-between">
                <Text size="sm">{a}</Text>
                <Button
                  id={`behavior-settings-remove-${a.replace(/\s+/g, '-').toLowerCase()}`}
                  variant="light"
                  onClick={() => removeAttr(a)}
                  disabled={!value.enabled}
                >
                  {tCommon('remove')}
                </Button>
              </Group>
            ))
          )}
        </Stack>

        <Group justify="flex-end">
          <Button id="behavior-settings-save" variant="light" onClick={onSave} loading={updateMutation.isPending || settingQuery.isLoading}>
            {tCommon('save')}
          </Button>
        </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
