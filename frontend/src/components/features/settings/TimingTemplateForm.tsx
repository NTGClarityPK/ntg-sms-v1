'use client';

import { ActionIcon, Button, Divider, Group, Modal, NumberInput, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useTranslations } from 'next-intl';

export interface TimingSlotFormValue {
  name: string;
  startTime?: string;
  endTime?: string;
  sortOrder?: number;
}

export interface TimingTemplateFormValues {
  name: string;
  startTime: string;
  endTime: string;
  periodDurationMinutes: number;
  slots: TimingSlotFormValue[];
}

interface TimingTemplateFormProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: TimingTemplateFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function TimingTemplateForm({ opened, onClose, onSubmit, isSubmitting }: TimingTemplateFormProps) {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const form = useForm<TimingTemplateFormValues>({
    initialValues: {
      name: '',
      startTime: '08:00',
      endTime: '14:00',
      periodDurationMinutes: 60,
      slots: [],
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('scheduleTimingNameRequired') : null),
      startTime: (v) => (!v ? tSettings('scheduleTimingStartTimeRequired') : null),
      endTime: (v, values) => {
        if (!v) return tSettings('scheduleTimingEndTimeRequired');
        if (values.startTime && v && values.startTime >= v) return tSettings('scheduleTimingEndTimeAfterStart');
        return null;
      },
      slots: {
        name: (v) => (v && v.trim().length === 0 ? tSettings('scheduleTimingSlotNameRequired') : null),
      },
    },
  });

  const addSlot = () => {
    form.insertListItem('slots', { name: '', startTime: '', endTime: '' });
  };

  const removeSlot = (index: number) => {
    form.removeListItem('slots', index);
  };

  const submit = form.onSubmit(async (values) => {
    const transformedValues = {
      ...values,
      name: values.name.trim(),
      slots: values.slots.map((slot, idx) => ({
        name: slot.name.trim(),
        startTime: slot.startTime || undefined,
        endTime: slot.endTime || undefined,
        sortOrder: idx,
      })),
    };
    await onSubmit(transformedValues);
    form.reset();
    onClose();
  });

  return (
    <Modal opened={opened} onClose={onClose} title={tSettings('scheduleTimingFormTitle')} size="lg">
      <form onSubmit={submit}>
        <Stack gap="md">
          <TextInput
            id="timing-template-name"
            label={tSettings('scheduleTimingFormNameLabel')}
            placeholder={tSettings('scheduleTimingFormNamePlaceholder')}
            {...form.getInputProps('name')}
          />
          <Group grow>
            <TextInput
              id="timing-template-start-time"
              label={tSettings('scheduleTimingFormStartTimeLabel')}
              placeholder={tSettings('scheduleTimingFormStartTimePlaceholder')}
              type="time"
              {...form.getInputProps('startTime')}
            />
            <TextInput
              id="timing-template-end-time"
              label={tSettings('scheduleTimingFormEndTimeLabel')}
              placeholder={tSettings('scheduleTimingFormEndTimePlaceholder')}
              type="time"
              {...form.getInputProps('endTime')}
            />
          </Group>
          <NumberInput
            id="timing-template-period-duration"
            label={tSettings('scheduleTimingFormPeriodDurationLabel')}
            placeholder={tSettings('scheduleTimingFormPeriodDurationPlaceholder')}
            min={1}
            {...form.getInputProps('periodDurationMinutes')}
          />

          <Divider my="sm" />

          <Group justify="space-between" align="center">
            <Text fw={500}>{tSettings('scheduleTimingFormSlotsTitle')}</Text>
            <Button
              id="timing-template-add-slot"
              size="compact-sm"
              leftSection={<IconPlus size={16} />}
              onClick={addSlot}
              variant="light"
            >
              {tSettings('scheduleTimingFormAddSlotButton')}
            </Button>
          </Group>

          {form.values.slots.length === 0 ? (
            <Text size="sm" c="dimmed">
              {tSettings('scheduleTimingFormNoSlotsText')}
            </Text>
          ) : (
            <Stack gap="sm">
              {form.values.slots.map((slot, index) => (
                <Paper key={index} withBorder p="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>
                        {tSettings('scheduleTimingFormSlotLabel', { number: index + 1 })}
                      </Text>
                      <ActionIcon
                        variant="subtle"
                        color={colors.error}
                        onClick={() => removeSlot(index)}
                        size="sm"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                    <TextInput
                      id={`timing-template-slot-${index}-name`}
                      label={tSettings('scheduleTimingFormSlotNameLabel')}
                      placeholder={tSettings('scheduleTimingFormSlotNamePlaceholder')}
                      {...form.getInputProps(`slots.${index}.name`)}
                    />
                    <Group grow>
                      <TextInput
                        id={`timing-template-slot-${index}-start`}
                        label={tSettings('scheduleTimingFormSlotStartLabel')}
                        placeholder={tSettings('scheduleTimingFormSlotStartPlaceholder')}
                        type="time"
                        {...form.getInputProps(`slots.${index}.startTime`)}
                      />
                      <TextInput
                        id={`timing-template-slot-${index}-end`}
                        label={tSettings('scheduleTimingFormSlotEndLabel')}
                        placeholder={tSettings('scheduleTimingFormSlotEndPlaceholder')}
                        type="time"
                        {...form.getInputProps(`slots.${index}.endTime`)}
                      />
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}

          <Group justify="flex-end" mt="md">
            <Button id="timing-template-cancel" variant="light" onClick={onClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button id="timing-template-submit" type="submit" loading={isSubmitting}>
              {tCommon('save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
