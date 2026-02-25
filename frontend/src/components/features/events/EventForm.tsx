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
  Switch,
  Group,
  Skeleton,
  MultiSelect,
  Alert,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { z } from 'zod';
import type { Event, CreateEventInput, UpdateEventInput } from '@/types/events';
import { TranslatableInput, type TranslatableValue } from '@/components/common/TranslatableInput';
import { useTranslations } from 'next-intl';
import { useClassSections } from '@/hooks/useClassSections';
import { useStudents } from '@/hooks/useStudents';
import { useCheckEventConflicts } from '@/hooks/api/useEvents';
import dayjs from 'dayjs';

const eventSchema = z
  .object({
    titleTranslations: z.object({ en: z.string(), ar: z.string() }),
    descriptionTranslations: z.object({ en: z.string(), ar: z.string() }).optional(),
    startDate: z.date({ required_error: 'Start date is required' }),
    endDate: z.date({ required_error: 'End date is required' }),
    requiresConsent: z.boolean().optional(),
    consentDeadline: z.date().nullable().optional(),
    classSectionIds: z.array(z.string().uuid()).optional(),
    studentIds: z.array(z.string().uuid()).optional(),
  })
  .refine((data) => (data.titleTranslations?.en ?? '').trim() !== '' || (data.titleTranslations?.ar ?? '').trim() !== '', {
    message: 'Title (EN or AR) is required',
    path: ['titleTranslations'],
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

const emptyTranslations: TranslatableValue = { en: '', ar: '' };

type FormValues = {
  titleTranslations: TranslatableValue;
  descriptionTranslations: TranslatableValue;
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
  const tStudents = useTranslations('students');
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
      titleTranslations: event ? { en: event.title ?? '', ar: '' } : { ...emptyTranslations },
      descriptionTranslations: event ? { en: event.description ?? '', ar: '' } : { ...emptyTranslations },
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

  /** Format date as local YYYY-MM-DD so the calendar date is preserved (avoids UTC shift). */
  const toLocalDateString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Check for conflicts when dates and class sections are entered
  const startDateStr = form.values.startDate ? toLocalDateString(form.values.startDate) : null;
  const endDateStr = form.values.endDate ? toLocalDateString(form.values.endDate) : null;

  const { data: conflictsData } = useCheckEventConflicts(
    startDateStr,
    endDateStr,
    form.values.classSectionIds,
  );

  const conflicts = conflictsData?.data;

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
        titleTranslations: { en: event.title ?? '', ar: '' },
        descriptionTranslations: { en: event.description ?? '', ar: '' },
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
    const title = (values.titleTranslations.en ?? '').trim() || (values.titleTranslations.ar ?? '').trim();
    const description =
      (values.descriptionTranslations.en ?? '').trim() || (values.descriptionTranslations.ar ?? '').trim() || undefined;
    const payload: CreateEventInput | UpdateEventInput = {
      title,
      description,
      title_translations: values.titleTranslations,
      description_translations:
        (values.descriptionTranslations.en ?? '').trim() || (values.descriptionTranslations.ar ?? '').trim()
          ? values.descriptionTranslations
          : undefined,
      startDate: values.startDate ? toLocalDateString(values.startDate) : '',
      endDate: values.endDate ? toLocalDateString(values.endDate) : '',
      requiresConsent: values.requiresConsent,
      consentDeadline: values.consentDeadline
        ? toLocalDateString(values.consentDeadline)
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
        label: `${s.studentId} - ${`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Unknown'}`,
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
    return tStudents('studentsAvailable', { count: students.length });
  }, [selectedClassSectionIds, studentsLoading, students.length, tStudents]);

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
    <form id="event-form" onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TranslatableInput
          id="event-form-title"
          label="Title"
          value={form.values.titleTranslations}
          onChange={(v) => form.setFieldValue('titleTranslations', v)}
          required
          placeholder={{ en: 'Enter event title', ar: 'أدخل عنوان الحدث' }}
        />

        <TranslatableInput
          id="event-form-description"
          label="Description"
          value={form.values.descriptionTranslations}
          onChange={(v) => form.setFieldValue('descriptionTranslations', v)}
          placeholder={{ en: 'Enter event description', ar: 'أدخل وصف الحدث' }}
        />

        <Group grow>
          <DatePickerInput
            id="event-form-start-date"
            label="Start Date"
            placeholder="Select start date"
            required
            {...form.getInputProps('startDate')}
          />
          <DatePickerInput
            id="event-form-end-date"
            label="End Date"
            placeholder="Select end date"
            required
            {...form.getInputProps('endDate')}
          />
        </Group>

        <Switch
          id="event-form-requires-consent"
          label="Requires Parent Consent"
          description="Parents must approve their child's participation"
          {...form.getInputProps('requiresConsent', { type: 'checkbox' })}
        />

        {form.values.requiresConsent && (
          <DatePickerInput
            id="event-form-consent-deadline"
            label="Consent Deadline"
            placeholder="Select consent deadline"
            description="Deadline for parents to submit consent (must be before start date)"
            {...form.getInputProps('consentDeadline')}
          />
        )}

        <MultiSelect
          id="event-form-class-sections"
          label="Class Sections"
          placeholder="Select class sections"
          description="Select classes participating in this event"
          data={classSections}
          {...form.getInputProps('classSectionIds')}
          clearable
          searchable
        />

        <MultiSelect
          id="event-form-students"
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

        {/* Conflicts Warning */}
        {conflicts &&
          (conflicts.assessmentConflicts.length > 0 || conflicts.eventConflicts.length > 0) && (
            <Alert color="yellow" title="Conflicts Detected">
              <Stack gap="xs">
                {conflicts.assessmentConflicts.length > 0 && (
                  <div>
                    <Text fw={500}>Assessment Conflicts:</Text>
                    <ul>
                      {conflicts.assessmentConflicts.map((conflict) => (
                        <li key={conflict.id}>
                          {conflict.title} (Due: {dayjs(conflict.dueDate).format('MMM D, YYYY')})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {conflicts.eventConflicts.length > 0 && (
                  <div>
                    <Text fw={500}>Event Conflicts:</Text>
                    <ul>
                      {conflicts.eventConflicts.map((conflict) => (
                        <li key={conflict.id}>
                          {conflict.title} (
                          {dayjs(conflict.startDate).format('MMM D')} –{' '}
                          {dayjs(conflict.endDate).format('MMM D, YYYY')})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Stack>
            </Alert>
          )}

        <Group justify="flex-end" mt="md">
          <Button id="event-form-submit" type="submit" loading={isLoading}>
            {event ? 'Update Event' : 'Create Event'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

