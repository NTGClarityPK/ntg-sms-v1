'use client';

import { useEffect, useMemo, useRef } from 'react';
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
import { IconCalendar, IconClock } from '@tabler/icons-react';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useCreateEarlyDeparture } from '@/hooks/useEarlyDepartures';
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
}

export function EarlyDepartureForm({ student }: EarlyDepartureFormProps) {
  const colors = useThemeColors();
  const createRequest = useCreateEarlyDeparture();
  const { data: timingTemplatesData } = useTimingTemplates();
  const timeInputRef = useRef<HTMLInputElement | null>(null);

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
      // Format for HTML time input (HH:MM)
      minTime: timingTemplate.startTime.slice(0, 5), // Extract HH:MM from HH:MM:SS
      maxTime: timingTemplate.endTime.slice(0, 5),
    };
  }, [timingTemplate]);

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
            ref={timeInputRef}
            label="Departure time"
            type="time"
            value={form.values.departureTime}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const value = e.currentTarget.value;
              form.setFieldValue('departureTime', value);
              // Validate immediately when time changes using the current validation function
              // Use setTimeout to ensure the value is set before validation
              setTimeout(() => {
                const error = validateDepartureTime(value);
                if (error) {
                  form.setFieldError('departureTime', error);
                } else {
                  form.clearFieldError('departureTime');
                }
              }, 0);
            }}
            onBlur={() => {
              // Validate on blur as well
              const error = validateDepartureTime(form.values.departureTime);
              if (error) {
                form.setFieldError('departureTime', error);
              } else {
                form.clearFieldError('departureTime');
              }
            }}
            placeholder="Select time"
            leftSection={<IconClock size={16} />}
            error={form.errors.departureTime}
            min={schoolHours?.minTime}
            max={schoolHours?.maxTime}
            description={
              timingTemplate
                ? `School hours: ${timingTemplate.startTime.slice(0, 5)} - ${timingTemplate.endTime.slice(0, 5)}`
                : 'School hours not configured'
            }
            onClick={() => {
              // Open the native time picker when clicking anywhere on the input
              const input = timeInputRef.current;
              if (input) {
                if ('showPicker' in input && typeof input.showPicker === 'function') {
                  input.showPicker();
                } else {
                  input.focus();
                }
              }
            }}
            styles={{
              input: {
                cursor: 'pointer',
                // Highlight field in red when there's an error
                ...(form.errors.departureTime && {
                  borderColor: colors.error,
                  '&:focus': {
                    borderColor: colors.error,
                    boxShadow: `0 0 0 1px ${colors.error}`,
                  },
                }),
                // Hide the native browser clock icon on the right
                '&::-webkit-calendar-picker-indicator': {
                  display: 'none',
                },
                '&::-webkit-inner-spin-button': {
                  display: 'none',
                },
                '&::-webkit-outer-spin-button': {
                  display: 'none',
                },
              },
            }}
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


