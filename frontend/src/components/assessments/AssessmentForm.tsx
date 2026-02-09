'use client';

/**
 * Assessment Form Component
 * Form for creating and editing assessments
 */

import { useForm, zodResolver } from '@mantine/form';
import { Button, Stack, TextInput, Textarea, NumberInput, Select, Switch, Group, Skeleton, Divider } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar } from '@tabler/icons-react';
import { z } from 'zod';
import type { Assessment, CreateAssessmentInput, UpdateAssessmentInput } from '@/types/assessment';
import { useAssessmentTypes } from '@/hooks/useAssessmentSettings';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useClassSections } from '@/hooks/useClassSections';
import { useMemo } from 'react';
import { FileUpload } from './FileUpload';
import { FileUploadForCreate } from './FileUploadForCreate';

const assessmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assessmentTypeId: z.string().uuid('Invalid assessment type'),
  subjectId: z.string().uuid('Invalid subject'),
  classSectionId: z.string().uuid('Invalid class section'),
  totalMarks: z.number().min(0.01, 'Total marks must be greater than 0'),
  dueDate: z.date().nullable().optional(),
  publishDate: z.date().nullable().optional(),
  isPublished: z.boolean().optional(),
  allowLateSubmission: z.boolean().optional(),
});

type FormValues = {
  title: string;
  description?: string;
  assessmentTypeId: string;
  subjectId: string;
  classSectionId: string;
  totalMarks: number;
  dueDate?: Date | null;
  publishDate?: Date | null;
  isPublished?: boolean;
  allowLateSubmission?: boolean;
};

interface AssessmentFormProps {
  assessment?: Assessment;
  onSubmit: (values: CreateAssessmentInput | UpdateAssessmentInput) => void;
  isLoading?: boolean;
  filesToUpload?: File[];
  onFilesChange?: (files: File[]) => void;
}

export function AssessmentForm({ assessment, onSubmit, isLoading, filesToUpload = [], onFilesChange }: AssessmentFormProps) {
  // Fetch data for dropdowns
  const { data: assessmentTypesData, isLoading: assessmentTypesLoading } = useAssessmentTypes();
  const { data: subjectsData, isLoading: subjectsLoading } = useSubjects();
  const { data: classSectionsData, isLoading: classSectionsLoading } = useClassSections({
    isActive: true,
    limit: 100, // Backend max limit is 100
  });

  const form = useForm<FormValues>({
    validate: zodResolver(assessmentSchema),
    initialValues: {
      title: assessment?.title ?? '',
      description: assessment?.description ?? '',
      assessmentTypeId: assessment?.assessmentTypeId ?? '',
      subjectId: assessment?.subjectId ?? '',
      classSectionId: assessment?.classSectionId ?? '',
      totalMarks: assessment?.totalMarks ?? 100,
      dueDate: assessment?.dueDate ? new Date(assessment.dueDate) : null,
      publishDate: assessment?.publishDate ? new Date(assessment.publishDate) : null,
      isPublished: assessment?.isPublished ?? false,
      allowLateSubmission: assessment?.allowLateSubmission ?? false,
    },
  });

  const handleSubmit = (values: FormValues) => {
    const payload: CreateAssessmentInput | UpdateAssessmentInput = {
      title: values.title,
      description: values.description || undefined,
      assessmentTypeId: values.assessmentTypeId,
      subjectId: values.subjectId,
      classSectionId: values.classSectionId,
      totalMarks: values.totalMarks,
      dueDate: values.dueDate ? values.dueDate.toISOString().split('T')[0] : undefined,
      publishDate: values.publishDate ? values.publishDate.toISOString().split('T')[0] : undefined,
      isPublished: values.isPublished,
      allowLateSubmission: values.allowLateSubmission,
    };
    onSubmit(payload);
  };

  // Transform API data into select options
  const assessmentTypes = useMemo(
    () =>
      assessmentTypesData?.data?.map((type) => ({
        value: type.id,
        label: type.name,
      })) || [],
    [assessmentTypesData],
  );

  const subjects = useMemo(
    () =>
      subjectsData?.data?.map((subject) => ({
        value: subject.id,
        label: subject.name,
      })) || [],
    [subjectsData],
  );

  const classSections = useMemo(
    () =>
      classSectionsData?.data?.map((cs) => ({
        value: cs.id,
        label: `${cs.className} - ${cs.sectionName}`,
      })) || [],
    [classSectionsData],
  );

  const dataLoading = assessmentTypesLoading || subjectsLoading || classSectionsLoading;

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
        <TextInput label="Title" placeholder="Enter assessment title" required {...form.getInputProps('title')} />

        <Textarea
          label="Description"
          placeholder="Enter assessment description"
          minRows={3}
          {...form.getInputProps('description')}
        />

        <Group grow>
          <Select
            label="Assessment Type"
            placeholder="Select type"
            data={assessmentTypes}
            required
            {...form.getInputProps('assessmentTypeId')}
          />

          <Select
            label="Subject"
            placeholder="Select subject"
            data={subjects}
            required
            {...form.getInputProps('subjectId')}
          />
        </Group>

        <Select
          label="Class Section"
          placeholder="Select class section"
          data={classSections}
          required
          {...form.getInputProps('classSectionId')}
        />

        <Group grow>
          <NumberInput
            label="Total Marks"
            placeholder="Enter total marks"
            min={0}
            required
            {...form.getInputProps('totalMarks')}
          />

          <DatePickerInput
            label="Due Date"
            placeholder="Select due date"
            leftSection={<IconCalendar size={16} />}
            {...form.getInputProps('dueDate')}
          />
        </Group>

        <DatePickerInput
          label="Publish Date"
          placeholder="Select publish date"
          leftSection={<IconCalendar size={16} />}
          {...form.getInputProps('publishDate')}
        />

        <Group>
          <Switch label="Published" {...form.getInputProps('isPublished', { type: 'checkbox' })} />

          <Switch
            label="Allow Late Submission"
            {...form.getInputProps('allowLateSubmission', { type: 'checkbox' })}
          />
        </Group>

        <Divider my="md" />
        {assessment?.id ? (
          <FileUpload assessmentId={assessment.id} />
        ) : (
          <FileUploadForCreate files={filesToUpload} onFilesChange={onFilesChange || (() => {})} />
        )}

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isLoading}>
            {assessment ? 'Update Assessment' : 'Create Assessment'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

