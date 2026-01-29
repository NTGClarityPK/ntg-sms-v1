'use client';

import {
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useCreateEarlyDeparture } from '@/hooks/useEarlyDepartures';
import type { Student } from '@/types/students';

const schema = z.object({
  studentId: z.string().uuid(),
  date: z.date(),
  departureTime: z.string().min(1, 'Departure time is required'),
  reason: z.string().optional(),
});

interface EarlyDepartureFormProps {
  student: Student | null;
}

export function EarlyDepartureForm({ student }: EarlyDepartureFormProps) {
  const colors = useThemeColors();
  const createRequest = useCreateEarlyDeparture();

  const form = useForm({
    initialValues: {
      studentId: student?.id ?? '',
      date: new Date(),
      departureTime: '',
      reason: '',
    },
    validate: zodResolver(schema),
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await createRequest.mutateAsync({
        studentId: values.studentId,
        date: values.date.toISOString().slice(0, 10),
        departureTime: values.departureTime,
        reason: values.reason,
      });
      form.reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: 'Error',
        message,
        color: colors.error,
      });
    }
  };

  return (
    <Paper withBorder p="md">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text fw={600}>Request early departure</Text>
          <DatePickerInput
            label="Date"
            {...form.getInputProps('date')}
            placeholder="Select date"
            leftSection={<IconCalendar size={16} />}
          />
          <TextInput
            label="Departure time"
            placeholder="11:00"
            {...form.getInputProps('departureTime')}
          />
          <Textarea
            label="Reason"
            minRows={2}
            {...form.getInputProps('reason')}
          />
          <Group justify="flex-end">
            <Button
              type="submit"
              variant="light"
              loading={createRequest.isPending}
              disabled={!student}
            >
              Submit request
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}


