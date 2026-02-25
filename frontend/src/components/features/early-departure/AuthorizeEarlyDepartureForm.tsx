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
import { IconCalendar, IconClock, IconPhone, IconMail, IconUser, IconWifiOff } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useAuthorizeEarlyDeparture, useCheckEarlyDepartureConflict } from '@/hooks/useEarlyDepartures';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTimingTemplates } from '@/hooks/useScheduleSettings';
import { useStudents } from '@/hooks/useStudents';
import { useStudentGuardians } from '@/hooks/useParentAssociations';

interface AuthorizeEarlyDepartureFormProps {
  /** Called after authorization is successfully submitted (e.g. switch to All requests tab). */
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

export function AuthorizeEarlyDepartureForm({ onSuccess }: AuthorizeEarlyDepartureFormProps) {
  const colors = useThemeColors();
  const isOnline = useOnlineStatus();
  const authorizeRequest = useAuthorizeEarlyDeparture();
  const { data: timingTemplatesData } = useTimingTemplates();
  const { data: studentsData } = useStudents({ page: 1, limit: 100 });

  const availableStudents = studentsData?.data ?? [];

  // Find timing template - use first available or default
  const timingTemplate = useMemo(() => {
    if (!timingTemplatesData?.data || timingTemplatesData.data.length === 0) {
      return null;
    }
    return timingTemplatesData.data[0];
  }, [timingTemplatesData?.data]);

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
      studentId: '',
      date: new Date(),
      departureTime: '',
      reason: '',
    },
    validate: {
      studentId: (value) => (!value ? 'Student is required' : null),
      departureTime: (value) => validateDepartureTime(value),
    },
  });

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

  // Fetch guardians when student is selected
  const guardiansQuery = useStudentGuardians(form.values.studentId || null);
  const guardians = guardiansQuery.data?.data ?? [];
  const primaryGuardian = guardians.find((g) => g.priority === 1);
  const secondaryGuardian = guardians.find((g) => g.priority === 2);

  // Check for class conflicts when date and time are selected
  const dateStr = form.values.date ? form.values.date.toISOString().slice(0, 10) : null;
  const conflictCheck = useCheckEarlyDepartureConflict(
    form.values.studentId || null,
    dateStr,
    form.values.departureTime || null,
  );
  const hasConflict = conflictCheck.data?.hasConflict ?? false;
  const conflictDetails = conflictCheck.data?.conflictDetails;

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await authorizeRequest.mutateAsync({
        studentId: values.studentId,
        date: values.date.toISOString().slice(0, 10),
        departureTime: values.departureTime,
        reason: values.reason,
      });
      form.reset();
      onSuccess?.();
    } catch {
      // Error notification is shown by useAuthorizeEarlyDeparture onError with backend message
    }
  };

  return (
    <Paper withBorder p="md">
      <form id="authorize-early-departure-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Text fw={600}>Authorize Early Departure</Text>
          <Text size="sm" c="dimmed">
            Authorize a student's early departure. This will immediately notify the parent(s) and mark the request as excused.
          </Text>
          {!isOnline && (
            <Alert color="red" icon={<IconWifiOff size={16} />}>
              No internet connection. Please connect to submit.
            </Alert>
          )}
          <Select
            id="authorize-early-departure-student"
            label="Student"
            placeholder="Select student"
            data={availableStudents.map((s) => ({
              value: s.id,
              label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || `Student ${s.id.slice(0, 8)}`,
            }))}
            value={form.values.studentId}
            onChange={(value) => form.setFieldValue('studentId', value ?? '')}
            error={form.errors.studentId}
            searchable
            required
          />
          {form.values.studentId && (
            <Alert color={colors.info} title="Emergency Contact Information">
              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  If this is an emergency, you can contact the guardian:
                </Text>
                {primaryGuardian ? (
                  <Paper p="sm" withBorder>
                    <Stack gap="xs">
                      <Group gap="xs">
                        <IconUser size={16} />
                        <Text size="sm" fw={500}>
                          Primary Guardian ({primaryGuardian.relationship})
                        </Text>
                      </Group>
                      <Text size="sm">
                        <strong>Name:</strong> {primaryGuardian.parentName || 'Not available'}
                      </Text>
                      {primaryGuardian.parentPhone && (
                        <Group gap="xs">
                          <IconPhone size={14} />
                          <Text size="sm">
                            <strong>Phone:</strong> {primaryGuardian.parentPhone}
                          </Text>
                        </Group>
                      )}
                      {primaryGuardian.parentEmail && (
                        <Group gap="xs">
                          <IconMail size={14} />
                          <Text size="sm">
                            <strong>Email:</strong> {primaryGuardian.parentEmail}
                          </Text>
                        </Group>
                      )}
                      {!primaryGuardian.parentPhone && !primaryGuardian.parentEmail && (
                        <Text size="sm" c="dimmed">
                          Contact information not available
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                ) : (
                  <Text size="sm" c="dimmed">
                    Primary guardian information not available
                  </Text>
                )}
                {secondaryGuardian && (
                  <Paper p="sm" withBorder>
                    <Stack gap="xs">
                      <Group gap="xs">
                        <IconUser size={16} />
                        <Text size="sm" fw={500}>
                          Secondary Guardian ({secondaryGuardian.relationship})
                        </Text>
                      </Group>
                      <Text size="sm">
                        <strong>Name:</strong> {secondaryGuardian.parentName || 'Not available'}
                      </Text>
                      {secondaryGuardian.parentPhone && (
                        <Group gap="xs">
                          <IconPhone size={14} />
                          <Text size="sm">
                            <strong>Phone:</strong> {secondaryGuardian.parentPhone}
                          </Text>
                        </Group>
                      )}
                      {secondaryGuardian.parentEmail && (
                        <Group gap="xs">
                          <IconMail size={14} />
                          <Text size="sm">
                            <strong>Email:</strong> {secondaryGuardian.parentEmail}
                          </Text>
                        </Group>
                      )}
                      {!secondaryGuardian.parentPhone && !secondaryGuardian.parentEmail && (
                        <Text size="sm" c="dimmed">
                          Contact information not available
                        </Text>
                      )}
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Alert>
          )}
          <DatePickerInput
            id="authorize-early-departure-date"
            label="Date"
            {...form.getInputProps('date')}
            placeholder="Select date"
            leftSection={<IconCalendar size={16} />}
          />
          <Select
            id="authorize-early-departure-time"
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
            required
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
            <Alert color={colors.warning} title="Class Conflict Warning">
              <Text size="sm">
                The selected departure time conflicts with an ongoing class: <strong>{conflictDetails}</strong>.
                You can still authorize the departure, but please be aware of this conflict.
              </Text>
            </Alert>
          )}
          <Textarea
            id="authorize-early-departure-reason"
            label="Reason (optional)"
            minRows={2}
            {...form.getInputProps('reason')}
            placeholder="Enter reason for early departure authorization"
          />
          <Group justify="flex-end">
            <Button
              id="authorize-early-departure-submit"
              type="submit"
              variant="light"
              loading={authorizeRequest.isPending}
              disabled={
                !isOnline ||
                !form.values.studentId ||
                !form.values.departureTime ||
                !!form.errors.departureTime ||
                !!form.errors.studentId
              }
            >
              {isOnline ? 'Authorize Early Departure' : 'No Internet Connection'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
