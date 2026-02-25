'use client';

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
  /** Called after a leave request is successfully submitted (e.g. switch to All requests tab). */
  onSuccess?: () => void;
}

export function LeaveRequestForm({ student, onSuccess }: LeaveRequestFormProps) {
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

  /** Format date as local YYYY-MM-DD so the calendar date is preserved (avoids UTC shift). */
  const toLocalDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await createLeave.mutateAsync({
        studentId: values.studentId,
        startDate: toLocalDateString(values.startDate),
        endDate: toLocalDateString(values.endDate),
        reason: values.reason,
      });
      form.reset();
      onSuccess?.();
    } catch {
      // Error notification is shown by useCreateLeaveRequest onError with backend message
    }
  };

  const quota = quotaQuery.data;
  const isQuotaExceeded = quota ? quota.usedDays > quota.totalQuota : false;

  return (
    <Paper withBorder p="md">
      <form id="leave-request-form" key={student?.id || 'no-student'} onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text fw={600}>Request leave</Text>
          {quota && (
            <Stack gap={4}>
              <Text
                size="sm"
                c={isQuotaExceeded ? 'red' : 'dimmed'}
                fw={isQuotaExceeded ? 600 : 400}
              >
                Leave quota used: {quota.usedDays}/{quota.totalQuota} days
                {isQuotaExceeded ? ' (Limit exceeded)' : ` (${quota.remainingDays} remaining)`}
              </Text>
              {(quota.daysFromAbsences ?? 0) > 0 && (
                <Text size="xs" c="dimmed">
                  This includes {quota.daysFromAbsences} day{quota.daysFromAbsences === 1 ? '' : 's'} marked absent (counted in quota).
                </Text>
              )}
            </Stack>
          )}
          <DatePickerInput
            id="leave-request-start-date"
            label="Start date"
            {...form.getInputProps('startDate')}
            placeholder="Select start date"
            leftSection={<IconCalendar size={16} />}
            maxDate={form.values.endDate || undefined}
          />
          <DatePickerInput
            id="leave-request-end-date"
            label="End date"
            {...form.getInputProps('endDate')}
            placeholder="Select end date"
            leftSection={<IconCalendar size={16} />}
            minDate={form.values.startDate || undefined}
          />
          <Textarea
            id="leave-request-reason"
            label="Reason"
            minRows={3}
            {...form.getInputProps('reason')}
          />
          <Group justify="flex-end">
            <Button
              id="leave-request-submit"
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


