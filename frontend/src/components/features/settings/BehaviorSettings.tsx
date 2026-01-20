'use client';

import { Alert, Button, Checkbox, Group, Paper, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';

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

export function BehaviorSettings() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const settingQuery = useSystemSetting<BehavioralAssessmentValue>('behavioral_assessment');
  const updateMutation = useUpdateSystemSetting<BehavioralAssessmentValue>('behavioral_assessment');

  const [value, setValue] = useState<BehavioralAssessmentValue | null>(null);
  const [newAttr, setNewAttr] = useState('');

  useEffect(() => {
    const remote = settingQuery.data?.data?.value;
    // Initialize from backend once when we don't yet have a local value
    if (!value && remote && typeof remote === 'object') {
      setValue({
        enabled: remote.enabled ?? DEFAULT_VALUE.enabled,
        mandatory: remote.mandatory ?? DEFAULT_VALUE.mandatory,
        attributes: Array.isArray(remote.attributes) ? remote.attributes : DEFAULT_VALUE.attributes,
      });
      return;
    }

    // If no remote setting exists at all, initialize once with defaults
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
      notifications.show({ title: 'Success', message: 'Behavior settings saved', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (settingQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load settings">
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  if (!value) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" py="md">
          <Text size="sm" c="dimmed">
            Loading behavior settings...
          </Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={600}>Behavioral assessment</Text>

        <Switch
          label="Enable behavioral assessment"
          checked={value.enabled}
          onChange={() =>
            setValue((prev) => ({
              ...(prev ?? DEFAULT_VALUE),
              enabled: !(prev ?? DEFAULT_VALUE).enabled,
              // When disabling, keep other fields but they will be ignored by UI
            }))
          }
        />

        <Checkbox
          label="Mandatory"
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
            label="Add attribute"
            placeholder="Discipline"
            value={newAttr}
            onChange={(e) => setNewAttr(e.currentTarget.value)}
            disabled={!value.enabled}
          />
          <Button variant="light" onClick={addAttr} disabled={!value.enabled}>
            Add
          </Button>
        </Group>

        <Stack gap="xs">
          {attrs.length === 0 ? (
            <Text c="dimmed" size="sm">
              No attributes yet.
            </Text>
          ) : (
            attrs.map((a) => (
              <Group key={a} justify="space-between">
                <Text size="sm">{a}</Text>
                <Button variant="light" onClick={() => removeAttr(a)} disabled={!value.enabled}>
                  Remove
                </Button>
              </Group>
            ))
          )}
        </Stack>

        <Group justify="flex-end">
          <Button variant="light" onClick={onSave} loading={updateMutation.isPending || settingQuery.isLoading}>
            Save
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}


