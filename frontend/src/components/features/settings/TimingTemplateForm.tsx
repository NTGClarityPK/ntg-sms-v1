'use client';

import { Button, Group, Modal, NumberInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';

export interface TimingTemplateFormValues {
  name: string;
  startTime: string;
  endTime: string;
  periodDurationMinutes: number;
  assemblyStart: string;
  assemblyEnd: string;
  breakStart: string;
  breakEnd: string;
}

interface TimingTemplateFormProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: TimingTemplateFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function TimingTemplateForm({ opened, onClose, onSubmit, isSubmitting }: TimingTemplateFormProps) {
  const form = useForm<TimingTemplateFormValues>({
    initialValues: {
      name: '',
      startTime: '',
      endTime: '',
      periodDurationMinutes: 60,
      assemblyStart: '',
      assemblyEnd: '',
      breakStart: '',
      breakEnd: '',
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      startTime: (v) => (!v ? 'Start time is required' : null),
      endTime: (v, values) => {
        if (!v) return 'End time is required';
        if (values.startTime && v && values.startTime >= v) return 'End time must be after start time';
        return null;
      },
    },
    transformValues: (v) => ({
      ...v,
      name: v.name.trim(),
      assemblyStart: v.assemblyStart.trim(),
      assemblyEnd: v.assemblyEnd.trim(),
      breakStart: v.breakStart.trim(),
      breakEnd: v.breakEnd.trim(),
    }),
  });

  const submit = form.onSubmit(async (values) => {
    await onSubmit(values);
    form.reset();
    onClose();
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create timing template" size="md">
      <form onSubmit={submit}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="Default" {...form.getInputProps('name')} />
          <Group grow>
            <TextInput label="Start time" type="time" {...form.getInputProps('startTime')} />
            <TextInput label="End time" type="time" {...form.getInputProps('endTime')} />
          </Group>
          <NumberInput label="Period duration (minutes)" min={1} {...form.getInputProps('periodDurationMinutes')} />
          <Group grow>
            <TextInput label="Assembly start (optional)" type="time" {...form.getInputProps('assemblyStart')} />
            <TextInput label="Assembly end (optional)" type="time" {...form.getInputProps('assemblyEnd')} />
          </Group>
          <Group grow>
            <TextInput label="Break start (optional)" type="time" {...form.getInputProps('breakStart')} />
            <TextInput label="Break end (optional)" type="time" {...form.getInputProps('breakEnd')} />
          </Group>

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


