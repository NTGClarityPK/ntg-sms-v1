'use client';

import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';

export interface AcademicYearFormValues {
  name: string;
  startDate: string;
  endDate: string;
}

interface AcademicYearFormProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: AcademicYearFormValues) => Promise<void>;
  isSubmitting: boolean;
}

export function AcademicYearForm({ opened, onClose, onSubmit, isSubmitting }: AcademicYearFormProps) {
  const notifyColors = useNotificationColors();

  const form = useForm<AcademicYearFormValues>({
    initialValues: {
      name: '',
      startDate: '',
      endDate: '',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      startDate: (value) => (!value ? 'Start date is required' : null),
      endDate: (value, values) => {
        if (!value) return 'End date is required';
        if (values.startDate && value && values.startDate >= value) return 'End date must be after start date';
        return null;
      },
    },
    transformValues: (values) => ({
      name: values.name.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
    }),
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await onSubmit(values);
      form.reset();
      onClose();
      notifications.show({
        title: 'Success',
        message: 'Academic year created',
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Create academic year" size="md">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="2025-2026" {...form.getInputProps('name')} />
          <TextInput label="Start date" type="date" {...form.getInputProps('startDate')} />
          <TextInput label="End date" type="date" {...form.getInputProps('endDate')} />
        </Stack>

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save
          </Button>
        </Group>
      </form>
    </Modal>
  );
}


