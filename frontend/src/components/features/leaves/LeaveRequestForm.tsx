'use client';

import { useEffect } from 'react';
import {
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useCreateLeaveRequest, useLeaveQuota } from '@/hooks/useLeaveRequests';
import type { Student } from '@/types/students';

const schema = z
  .object({
    studentId: z.string().uuid(),
    startDate: z.date(),
    endDate: z.date(),
    reason: z.string().min(1, 'Reason is required'),
  })
  .refine(
    (values) => values.endDate >= values.startDate,
    'End date cannot be before start date',
  );

interface LeaveRequestFormProps {
  student: Student | null;
}

export function LeaveRequestForm({ student }: LeaveRequestFormProps) {
  const colors = useThemeColors();
  const createLeave = useCreateLeaveRequest();
  const quotaQuery = useLeaveQuota(student?.id ?? null);

  const form = useForm({
    initialValues: {
      studentId: student?.id ?? '',
      startDate: new Date(),
      endDate: new Date(),
      reason: '',
    },
    validate: zodResolver(schema),
  });

  // Update form when student changes
  useEffect(() => {
    if (student?.id) {
      form.setFieldValue('studentId', student.id);
    }
  }, [student?.id, form]);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await createLeave.mutateAsync({
        studentId: values.studentId,
        startDate: values.startDate.toISOString().slice(0, 10),
        endDate: values.endDate.toISOString().slice(0, 10),
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

  const quota = quotaQuery.data;

  return (
    <Paper withBorder p="md">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text fw={600}>Request leave</Text>
          {quota && (
            <Text size="sm" c="dimmed">
              Leave quota used: {quota.usedDays}/{quota.totalQuota} days (
              {quota.remainingDays} remaining)
            </Text>
          )}
          <DatePickerInput
            label="Start date"
            {...form.getInputProps('startDate')}
            placeholder="Select start date"
            leftSection={<IconCalendar size={16} />}
            maxDate={form.values.endDate || undefined}
          />
          <DatePickerInput
            label="End date"
            {...form.getInputProps('endDate')}
            placeholder="Select end date"
            leftSection={<IconCalendar size={16} />}
            minDate={form.values.startDate || undefined}
          />
          <Textarea
            label="Reason"
            minRows={3}
            {...form.getInputProps('reason')}
          />
          <Group justify="flex-end">
            <Button
              type="submit"
              variant="light"
              loading={createLeave.isPending}
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


