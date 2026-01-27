'use client';

import { ActionIcon, Button, Divider, Group, Modal, NumberInput, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

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
  
  const form = useForm<TimingTemplateFormValues>({
    initialValues: {
      name: '',
      startTime: '08:00',
      endTime: '14:00',
      periodDurationMinutes: 60,
      slots: [],
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      startTime: (v) => (!v ? 'Start time is required' : null),
      endTime: (v, values) => {
        if (!v) return 'End time is required';
        if (values.startTime && v && values.startTime >= v) return 'End time must be after start time';
        return null;
      },
      slots: {
        name: (v) => (v && v.trim().length === 0 ? 'Slot name is required' : null),
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
    // Transform values: convert slots with sortOrder
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
    <Modal opened={opened} onClose={onClose} title="Create timing template" size="lg">
      <form onSubmit={submit}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="Primary Morning Schedule" {...form.getInputProps('name')} />
          <Group grow>
            <TextInput label="School start time" type="time" {...form.getInputProps('startTime')} />
            <TextInput label="School end time" type="time" {...form.getInputProps('endTime')} />
          </Group>
          <NumberInput label="Period duration (minutes)" min={1} {...form.getInputProps('periodDurationMinutes')} />

          <Divider my="sm" />

          <Group justify="space-between" align="center">
            <Text fw={500}>Slots (Assembly, Break, etc.)</Text>
            <Button size="compact-sm" leftSection={<IconPlus size={16} />} onClick={addSlot} variant="light">
              Add Slot
            </Button>
          </Group>

          {form.values.slots.length === 0 ? (
            <Text size="sm" c="dimmed">
              No slots added yet. Click "Add Slot" to add custom slots like Assembly, Break, Lunch, etc.
            </Text>
          ) : (
            <Stack gap="sm">
              {form.values.slots.map((slot, index) => (
                <Paper key={index} withBorder p="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={500}>Slot {index + 1}</Text>
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
                      label="Slot name"
                      placeholder="e.g., Assembly, Break, Lunch"
                      {...form.getInputProps(`slots.${index}.name`)}
                    />
                    <Group grow>
                      <TextInput
                        label="Start time (optional)"
                        type="time"
                        {...form.getInputProps(`slots.${index}.startTime`)}
                      />
                      <TextInput
                        label="End time (optional)"
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
            <Button variant="light" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}


