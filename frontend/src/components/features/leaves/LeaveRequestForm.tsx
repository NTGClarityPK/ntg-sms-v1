'use client';

import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar, IconWifiOff } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { useCreateLeaveRequest, useLeaveQuota } from '@/hooks/useLeaveRequests';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { Student } from '@/types/students';

interface LeaveRequestFormProps {
  student: Student | null;
  /** Called after a leave request is successfully submitted (e.g. switch to All requests tab). */
  onSuccess?: () => void;
}

export function LeaveRequestForm({ student, onSuccess }: LeaveRequestFormProps) {
  const t = useTranslations('leave');
  const isOnline = useOnlineStatus();
  const createLeave = useCreateLeaveRequest();
  const quotaQuery = useLeaveQuota(student?.id ?? null);

  const schema = z
    .object({
      studentId: z.string().uuid(),
      startDate: z.date(),
      endDate: z.date(),
      reason: z.string().min(1, t('reasonRequired')),
    })
    .refine(
      (values) => values.endDate >= values.startDate,
      t('endDateBeforeStart'),
    );

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
          <Text fw={600}>{t('requestLeave')}</Text>
          {!isOnline && (
            <Alert color="red" icon={<IconWifiOff size={16} />}>
              {t('noInternetSubmit')}
            </Alert>
          )}
          {quota && (
            <Stack gap={4}>
              <Text
                size="sm"
                c={isQuotaExceeded ? 'red' : 'dimmed'}
                fw={isQuotaExceeded ? 600 : 400}
              >
                {t('leaveQuotaUsed', { used: quota.usedDays, total: quota.totalQuota })}
                {isQuotaExceeded ? ` ${t('limitExceeded')}` : ` ${t('remainingDays', { remaining: quota.remainingDays })}`}
              </Text>
              {(quota.daysFromAbsences ?? 0) > 0 && (
                <Text size="xs" c="dimmed">
                  {t('daysFromAbsences', { count: quota.daysFromAbsences ?? 0 })}
                </Text>
              )}
            </Stack>
          )}
          <DatePickerInput
            id="leave-request-start-date"
            label={t('startDate')}
            value={form.values.startDate}
            onChange={(value) => {
              if (!value) return;
              form.setFieldValue('startDate', value);
              if (form.values.endDate && form.values.endDate < value) {
                form.setFieldValue('endDate', value);
              }
            }}
            placeholder={t('selectStartDate')}
            leftSection={<IconCalendar size={16} />}
          />
          <DatePickerInput
            id="leave-request-end-date"
            label={t('endDate')}
            value={form.values.endDate}
            onChange={(value) => {
              if (!value) return;
              form.setFieldValue('endDate', value);
            }}
            placeholder={t('selectEndDate')}
            leftSection={<IconCalendar size={16} />}
            minDate={form.values.startDate || undefined}
          />
          <Textarea
            id="leave-request-reason"
            label={t('reason')}
            minRows={3}
            {...form.getInputProps('reason')}
          />
          <Group justify="flex-end">
            <Button
              id="leave-request-submit"
              type="submit"
              variant="light"
              loading={createLeave.isPending}
              disabled={!isOnline || !student}
            >
              {isOnline ? t('submitRequest') : t('noInternetConnection')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}


