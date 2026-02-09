'use client';

/**
 * Event Form Component
 * Form for creating and editing events
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { useForm, zodResolver } from '@mantine/form';
import {
  Button,
  Stack,
  TextInput,
  Textarea,
  Select,
  Switch,
  Group,
  Skeleton,
  MultiSelect,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { z } from 'zod';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/events';
import { useClassSections } from '@/hooks/useClassSections';
import { useStudents } from '@/hooks/useStudents';

const eventSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    startDate: z.date({ required_error: 'Start date is required' }),
    endDate: z.date({ required_error: 'End date is required' }),
    requiresConsent: z.boolean().optional(),
    consentDeadline: z.date().nullable().optional(),
    classSectionIds: z.array(z.string().uuid()).optional(),
    studentIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be greater than or equal to start date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      if (data.requiresConsent && data.consentDeadline) {
        return data.consentDeadline <= data.startDate;
      }
      return true;
    },
    {
      message: 'Consent deadline must be before or equal to start date',
      path: ['consentDeadline'],
    },
  )
  .refine(
    (data) => {
      return (
        (data.classSectionIds && data.classSectionIds.length > 0) ||
        (data.studentIds && data.studentIds.length > 0)
      );
    },
    {
      message: 'At least one class section or student must be selected',
      path: ['classSectionIds'],
    },
  );

type FormValues = {
  title: string;
  description?: string;
  startDate: Date | null;
  endDate: Date | null;
  requiresConsent: boolean;
  consentDeadline: Date | null;
  classSectionIds: string[];
  studentIds: string[];
};

interface EventFormProps {
  event?: Event;
  onSubmit: (values: CreateEventInput | UpdateEventInput) => void;
  isLoading?: boolean;
}

export function EventForm({ event, onSubmit, isLoading }: EventFormProps) {
  // Track selected class sections to conditionally load students
  const [selectedClassSectionIds, setSelectedClassSectionIds] = useState<string[]>([]);

  // Fetch class sections for dropdowns
  const { data: classSectionsData, isLoading: classSectionsLoading } = useClassSections({
    isActive: true,
    limit: 100,
  });

  // Extract class IDs from selected class sections for filtering students
  const selectedClassIds = useMemo(() => {
    if (!classSectionsData?.data || selectedClassSectionIds.length === 0) {
      return [];
    }
    const selectedSections = classSectionsData.data.filter((cs) =>
      selectedClassSectionIds.includes(cs.id),
    );
    // Get unique class IDs
    return [...new Set(selectedSections.map((cs) => cs.classId))];
  }, [classSectionsData, selectedClassSectionIds]);

  // OPTIMIZED: Only load students when class sections are selected
  // This prevents loading ALL students upfront, dramatically improving performance
  const { data: studentsData, isLoading: studentsLoading } = useStudents(
    selectedClassIds.length > 0
      ? {
          classIds: selectedClassIds,
          isActive: true,
          limit: 100,
        }
      : undefined, // Don't load students if no class selected
  );

  const form = useForm<FormValues>({
    validate: zodResolver(eventSchema),
    initialValues: {
      title: event?.title ?? '',
      description: event?.description ?? '',
      startDate: event?.startDate ? new Date(event.startDate) : null,
      endDate: event?.endDate ? new Date(event.endDate) : null,
      requiresConsent: event?.requiresConsent ?? false,
      consentDeadline: event?.consentDeadline ? new Date(event.consentDeadline) : null,
      classSectionIds: [],
      studentIds: [],
    },
  });

  // Update selected class sections when form values change
  useEffect(() => {
    setSelectedClassSectionIds(form.values.classSectionIds);
  }, [form.values.classSectionIds]);

  // CRITICAL: Pre-populate form when editing
  // Use a ref to track if we've already initialized to prevent infinite loops
  const eventIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Only initialize once per event ID to prevent infinite loops
    if (event && event.id !== eventIdRef.current) {
      // Extract participants from event
      const classSectionIds = (event.participants || [])
        .filter((p) => p.classSectionId)
        .map((p) => p.classSectionId!)
        .filter((id): id is string => !!id);
      
      const studentIds = (event.participants || [])
        .filter((p) => p.studentId)
        .map((p) => p.studentId!)
        .filter((id): id is string => !!id);

      form.setValues({
        title: event.title,
        description: event.description ?? '',
        startDate: event.startDate ? new Date(event.startDate) : null,
        endDate: event.endDate ? new Date(event.endDate) : null,
        requiresConsent: event.requiresConsent,
        consentDeadline: event.consentDeadline ? new Date(event.consentDeadline) : null,
        classSectionIds,
        studentIds,
      });

      // Set selected class sections to trigger student loading
      setSelectedClassSectionIds(classSectionIds);
      eventIdRef.current = event.id;
    } else if (!event) {
      // Reset when event is cleared (e.g., switching from edit to create)
      eventIdRef.current = undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]); // Only depend on event.id, not the entire event object or form

  const handleSubmit = (values: FormValues) => {
    const payload: CreateEventInput | UpdateEventInput = {
      title: values.title,
      description: values.description || undefined,
      startDate: values.startDate ? values.startDate.toISOString().split('T')[0] : '',
      endDate: values.endDate ? values.endDate.toISOString().split('T')[0] : '',
      requiresConsent: values.requiresConsent,
      consentDeadline: values.consentDeadline
        ? values.consentDeadline.toISOString().split('T')[0]
        : undefined,
      classSectionIds: values.classSectionIds.length > 0 ? values.classSectionIds : undefined,
      studentIds: values.studentIds.length > 0 ? values.studentIds : undefined,
    };
    onSubmit(payload);
  };

  // Transform API data into select options
  const classSections = useMemo(
    () =>
      classSectionsData?.data?.map((cs) => ({
        value: cs.id,
        label: `${cs.className} - ${cs.sectionName}`,
      })) || [],
    [classSectionsData],
  );

  const students = useMemo(
    () =>
      studentsData?.data?.map((s) => ({
        value: s.id,
        label: `${s.studentId} - ${s.fullName || 'Unknown'}`,
      })) || [],
    [studentsData],
  );

  const dataLoading = classSectionsLoading;

  // Helper text for students select
  const studentSelectDescription = useMemo(() => {
    if (selectedClassSectionIds.length === 0) {
      return 'Select class sections first to load students from those classes';
    }
    if (studentsLoading) {
      return 'Loading students from selected classes...';
    }
    if (students.length === 0) {
      return 'No students found in selected classes';
    }
    return `${students.length} students available from selected classes`;
  }, [selectedClassSectionIds, studentsLoading, students.length]);

  if (dataLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} />
        <Skeleton height={100} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </Stack>
    );
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="Enter event title"
          required
          {...form.getInputProps('title')}
        />

        <Textarea
          label="Description"
          placeholder="Enter event description"
          minRows={3}
          {...form.getInputProps('description')}
        />

        <Group grow>
          <DatePickerInput
            label="Start Date"
            placeholder="Select start date"
            required
            {...form.getInputProps('startDate')}
          />
          <DatePickerInput
            label="End Date"
            placeholder="Select end date"
            required
            {...form.getInputProps('endDate')}
          />
        </Group>

        <Switch
          label="Requires Parent Consent"
          description="Parents must approve their child's participation"
          {...form.getInputProps('requiresConsent', { type: 'checkbox' })}
        />

        {form.values.requiresConsent && (
          <DatePickerInput
            label="Consent Deadline"
            placeholder="Select consent deadline"
            description="Deadline for parents to submit consent (must be before start date)"
            {...form.getInputProps('consentDeadline')}
          />
        )}

        <MultiSelect
          label="Class Sections"
          placeholder="Select class sections"
          description="Select classes participating in this event"
          data={classSections}
          {...form.getInputProps('classSectionIds')}
          clearable
          searchable
        />

        <MultiSelect
          label="Individual Students (Optional)"
          placeholder={
            selectedClassSectionIds.length === 0
              ? 'First select class sections above'
              : studentsLoading
                ? 'Loading students...'
                : 'Select additional individual students'
          }
          description={studentSelectDescription}
          data={students}
          {...form.getInputProps('studentIds')}
          disabled={selectedClassSectionIds.length === 0}
          clearable
          searchable
        />

        {(form.values.classSectionIds.length === 0 && form.values.studentIds.length === 0) && (
          <Alert color="yellow">
            Please select at least one class section or individual student.
          </Alert>
        )}

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isLoading}>
            {event ? 'Update Event' : 'Create Event'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

