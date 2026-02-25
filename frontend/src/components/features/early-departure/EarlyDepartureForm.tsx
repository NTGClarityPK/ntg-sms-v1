'use client';

import { useEffect, useMemo } from 'react';
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar, IconClock } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useCreateEarlyDeparture, useCheckEarlyDepartureConflict } from '@/hooks/useEarlyDepartures';
import { useTimingTemplates } from '@/hooks/useScheduleSettings';
import { useStudent } from '@/hooks/useStudents';
import type { Student } from '@/types/students';

const schema = z.object({
  studentId: z.string().uuid(),
  date: z.date(),
  departureTime: z.string().min(1, 'Departure time is required'),
  reason: z.string().optional(),
});

interface EarlyDepartureFormProps {
  student: Student | null;
  /** Called after a request is successfully submitted (e.g. switch to All requests tab). */
  onSuccess?: () => void;
}

// Build list of time options at 5-minute intervals between start and end (inclusive).
function buildTimeOptions(startMinutes: number, endMinutes: number): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (let m = startMinutes; m <= endMinutes; m += 5) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const value = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    options.push({ value, label: value });
  }
  return options;
}

export function EarlyDepartureForm({ student, onSuccess }: EarlyDepartureFormProps) {
  const colors = useThemeColors();
  const createRequest = useCreateEarlyDeparture();
  const { data: timingTemplatesData } = useTimingTemplates();

  // Fetch full student details to get classId
  // The hook returns response.data where response is ApiResponse<Student>
  // So fullStudentResponse is Student directly
  const { data: fullStudent } = useStudent(student?.id || null);

  // Find timing template for student's class
  const timingTemplate = useMemo(() => {
    // Check if we have the necessary data
    if (!fullStudent?.classId) {
      return null;
    }
    
    if (!timingTemplatesData?.data || timingTemplatesData.data.length === 0) {
      return null;
    }

    // Find template that includes this student's class
    const found = timingTemplatesData.data.find((template) => {
      if (!template.assignedClassIds || template.assignedClassIds.length === 0) {
        return false;
      }
      return template.assignedClassIds.includes(fullStudent.classId!);
    });
    
    return found || null;
  }, [fullStudent?.classId, timingTemplatesData?.data]);

  // Parse school start and end times
  const schoolHours = useMemo(() => {
    if (!timingTemplate) return null;
    
    const parseTime = (timeStr: string): Date => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours || 0, minutes || 0, 0, 0);
      return date;
    };

    return {
      startTime: parseTime(timingTemplate.startTime),
      endTime: parseTime(timingTemplate.endTime),
    };
  }, [timingTemplate]);

  // Departure time options: 5-minute steps only, between school start and end (or default 07:00–18:00)
  const departureTimeOptions = useMemo(() => {
    const startMinutes = schoolHours
      ? schoolHours.startTime.getHours() * 60 + schoolHours.startTime.getMinutes()
      : 7 * 60; // 07:00 default
    const endMinutes = schoolHours
      ? schoolHours.endTime.getHours() * 60 + schoolHours.endTime.getMinutes()
      : 18 * 60; // 18:00 default
    return buildTimeOptions(startMinutes, endMinutes);
  }, [schoolHours]);

  // Validation function that uses current schoolHours and timingTemplate
  const validateDepartureTime = (value: string): string | null => {
    if (!value) return 'Departure time is required';
    if (!schoolHours || !timingTemplate) {
      return null; // No validation if school hours not available
    }

    const [hours, minutes] = value.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      return 'Please select a valid time';
    }

    const timeInMinutes = hours * 60 + minutes;
    const startHours = schoolHours.startTime.getHours();
    const startMinutes = schoolHours.startTime.getMinutes();
    const endHours = schoolHours.endTime.getHours();
    const endMinutes = schoolHours.endTime.getMinutes();

    const startInMinutes = startHours * 60 + startMinutes;
    const endInMinutes = endHours * 60 + endMinutes;

    if (timeInMinutes < startInMinutes) {
      return `Departure time must be after school start time (${timingTemplate.startTime.slice(0, 5)})`;
    }
    if (timeInMinutes > endInMinutes) {
      return `Departure time must be before school end time (${timingTemplate.endTime.slice(0, 5)})`;
    }

    return null;
  };

  const form = useForm({
    initialValues: {
      studentId: student?.id ?? '',
      date: new Date(),
      departureTime: '',
      reason: '',
    },
    validate: {
      departureTime: (value) => validateDepartureTime(value),
    },
    // Don't use validateInputOnChange - we'll handle validation manually in onChange
  });

  // Update form when student changes
  useEffect(() => {
    if (student?.id) {
      form.setFieldValue('studentId', student.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  // Re-validate departure time when schoolHours or timingTemplate changes
  useEffect(() => {
    if (form.values.departureTime) {
      const error = validateDepartureTime(form.values.departureTime);
      if (error) {
        form.setFieldError('departureTime', error);
      } else {
        form.clearFieldError('departureTime');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolHours, timingTemplate]);

  // Check for class conflicts when date and time are selected
  const dateStr = form.values.date ? form.values.date.toISOString().slice(0, 10) : null;
  const conflictCheck = useCheckEarlyDepartureConflict(
    student?.id || null,
    dateStr,
    form.values.departureTime || null,
  );
  const hasConflict = conflictCheck.data?.hasConflict ?? false;
  const conflictDetails = conflictCheck.data?.conflictDetails;

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await createRequest.mutateAsync({
        studentId: values.studentId,
        date: values.date.toISOString().slice(0, 10),
        departureTime: values.departureTime,
        reason: values.reason,
      });
      form.reset();
      onSuccess?.();
    } catch {
      // Error notification is shown by useCreateEarlyDeparture onError with backend message
    }
  };

  return (
    <Paper withBorder p="md">
      <form id="early-departure-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text fw={600}>Request early departure</Text>
          <DatePickerInput
            id="early-departure-date"
            label="Date"
            {...form.getInputProps('date')}
            placeholder="Select date"
            leftSection={<IconCalendar size={16} />}
          />
          <Select
            id="early-departure-time"
            label="Departure time"
            placeholder="Select time"
            leftSection={<IconClock size={16} />}
            data={departureTimeOptions}
            value={form.values.departureTime}
            onChange={(value) => {
              form.setFieldValue('departureTime', value ?? '');
              const error = value ? validateDepartureTime(value) : 'Departure time is required';
              if (error) {
                form.setFieldError('departureTime', error);
              } else {
                form.clearFieldError('departureTime');
              }
            }}
            error={form.errors.departureTime}
            description={
              timingTemplate
                ? `School hours: ${timingTemplate.startTime.slice(0, 5)} - ${timingTemplate.endTime.slice(0, 5)}`
                : 'School hours not configured'
            }
            clearable
            searchable
            styles={{
              input: {
                ...(form.errors.departureTime && {
                  borderColor: colors.error,
                  '&:focus': {
                    borderColor: colors.error,
                    boxShadow: `0 0 0 1px ${colors.error}`,
                  },
                }),
              },
            }}
          />
          {hasConflict && conflictDetails && (
            <Alert color="yellow" title="Class Conflict Warning">
              <Text size="sm">
                The selected departure time conflicts with an ongoing class: <strong>{conflictDetails}</strong>.
                You can still submit the request, but please be aware of this conflict.
              </Text>
            </Alert>
          )}
          <Textarea
            id="early-departure-reason"
            label="Reason"
            minRows={2}
            {...form.getInputProps('reason')}
          />
          <Group justify="flex-end">
            <Button
              id="early-departure-submit"
              type="submit"
              variant="light"
              loading={createRequest.isPending}
              disabled={
                !student ||
                !form.values.departureTime ||
                !!form.errors.departureTime
              }
            >
              Submit request
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}


