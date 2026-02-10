'use client';

/**
 * Assessment Form Component
 * Form for creating and editing assessments
 */

import { useForm, zodResolver } from '@mantine/form';
import { Button, Stack, TextInput, Textarea, NumberInput, Select, Switch, Group, Skeleton, Divider, MultiSelect, Checkbox } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar } from '@tabler/icons-react';
import { z } from 'zod';
import type { Assessment, CreateAssessmentInput, UpdateAssessmentInput } from '@/types/assessment';
import { useAssessmentTypes } from '@/hooks/useAssessmentSettings';
import { useSubjects, useClasses } from '@/hooks/useCoreLookups';
import { useClassSections } from '@/hooks/useClassSections';
import { useTemplatesForClass } from '@/hooks/useSubjectTemplates';
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FileUpload } from './FileUpload';
import { FileUploadForCreate } from './FileUploadForCreate';

type CreationMode = 'single' | 'class-template' | 'class-sections';

const createAssessmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assessmentTypeId: z.string().uuid('Invalid assessment type'),
  subjectId: z.string().uuid('Invalid subject'),
  mode: z.enum(['single', 'class-template', 'class-sections']),
  classSectionId: z.string().uuid('Invalid class section').optional(),
  classId: z.string().uuid('Invalid class').optional(),
  subjectTemplateId: z.string().uuid('Invalid subject template').optional(),
  classSectionIds: z.array(z.string().uuid('Invalid class section')).optional(),
  totalMarks: z.number().min(0.01, 'Total marks must be greater than 0'),
  dueDate: z.date().nullable().optional(),
  publishDate: z.date().nullable().optional(),
  isPublished: z.boolean().optional(),
  allowLateSubmission: z.boolean().optional(),
}).refine((data) => {
  if (data.mode === 'single') {
    return !!data.classSectionId;
  } else if (data.mode === 'class-template') {
    return !!data.classId && !!data.subjectTemplateId;
  } else if (data.mode === 'class-sections') {
    return !!data.classId && !!data.classSectionIds && data.classSectionIds.length > 0;
  }
  return false;
}, {
  message: 'Please fill all required fields for the selected mode',
});

const updateAssessmentSchema = z.object({
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

type CreateFormValues = {
  title: string;
  description?: string;
  assessmentTypeId: string;
  subjectId: string;
  mode: CreationMode;
  classSectionId?: string;
  classId?: string;
  subjectTemplateId?: string;
  classSectionIds?: string[];
  totalMarks: number;
  dueDate?: Date | null;
  publishDate?: Date | null;
  isPublished?: boolean;
  allowLateSubmission?: boolean;
};

type UpdateFormValues = {
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
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const isEditMode = !!assessment;

  // Fetch data for dropdowns
  const { data: assessmentTypesData, isLoading: assessmentTypesLoading } = useAssessmentTypes();
  const { data: subjectsData, isLoading: subjectsLoading } = useSubjects();
  const { data: classesData, isLoading: classesLoading } = useClasses();
  const { data: classSectionsData, isLoading: classSectionsLoading } = useClassSections({
    isActive: true,
    limit: 100, // Backend max limit is 100
  });

  // Use different schemas for create vs update
  const createForm = useForm<CreateFormValues>({
    validate: zodResolver(createAssessmentSchema),
    initialValues: {
      title: '',
      description: '',
      assessmentTypeId: '',
      subjectId: '',
      mode: 'single',
      classSectionId: '',
      classId: '',
      subjectTemplateId: '',
      classSectionIds: [],
      totalMarks: 100,
      dueDate: null,
      publishDate: null,
      isPublished: false,
      allowLateSubmission: false,
    },
  });

  const updateForm = useForm<UpdateFormValues>({
    validate: zodResolver(updateAssessmentSchema),
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

  const form = isEditMode ? updateForm : createForm;

  // For class-level creation - must be after form declaration
  const selectedClassId = isEditMode ? undefined : (form.values as CreateFormValues).classId;
  const { data: templatesData, isLoading: templatesLoading } = useTemplatesForClass(
    selectedClassId || null,
    branchId || null,
  );
  const { data: classSectionsForClassData, isLoading: classSectionsForClassLoading } = useClassSections({
    classId: selectedClassId,
    isActive: true,
    limit: 100,
  });

  const handleSubmit = (values: CreateFormValues | UpdateFormValues) => {
    if (isEditMode) {
      const updateValues = values as UpdateFormValues;
      const payload: UpdateAssessmentInput = {
        title: updateValues.title,
        description: updateValues.description || undefined,
        assessmentTypeId: updateValues.assessmentTypeId,
        subjectId: updateValues.subjectId,
        classSectionId: updateValues.classSectionId,
        totalMarks: updateValues.totalMarks,
        dueDate: updateValues.dueDate ? updateValues.dueDate.toISOString().split('T')[0] : undefined,
        publishDate: updateValues.publishDate ? updateValues.publishDate.toISOString().split('T')[0] : undefined,
        isPublished: updateValues.isPublished,
        allowLateSubmission: updateValues.allowLateSubmission,
      };
      onSubmit(payload);
    } else {
      const createValues = values as CreateFormValues;
      const payload: CreateAssessmentInput = {
        title: createValues.title,
        description: createValues.description || undefined,
        assessmentTypeId: createValues.assessmentTypeId,
        subjectId: createValues.subjectId,
        totalMarks: createValues.totalMarks,
        dueDate: createValues.dueDate ? createValues.dueDate.toISOString().split('T')[0] : undefined,
        publishDate: createValues.publishDate ? createValues.publishDate.toISOString().split('T')[0] : undefined,
        isPublished: createValues.isPublished,
        allowLateSubmission: createValues.allowLateSubmission,
      };

      if (createValues.mode === 'single') {
        payload.classSectionId = createValues.classSectionId;
      } else if (createValues.mode === 'class-template') {
        payload.classId = createValues.classId;
        payload.subjectTemplateId = createValues.subjectTemplateId;
      } else if (createValues.mode === 'class-sections') {
        payload.classId = createValues.classId;
        payload.classSectionIds = createValues.classSectionIds;
      }

      onSubmit(payload);
    }
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

  const allSubjects = useMemo(
    () =>
      subjectsData?.data?.map((subject) => ({
        value: subject.id,
        label: subject.name,
      })) || [],
    [subjectsData],
  );

  // Filter subjects based on selected subject template
  const subjects = useMemo(() => {
    let filteredSubjects = allSubjects;
    if (!isEditMode) {
      const createValues = form.values as CreateFormValues;
      if (createValues.mode === 'class-template' && createValues.subjectTemplateId) {
        const selectedTemplate = templatesData?.data?.find(
          (t) => t.id === createValues.subjectTemplateId,
        );
        if (selectedTemplate?.subjectIds) {
          filteredSubjects = allSubjects.filter((s) => selectedTemplate.subjectIds.includes(s.value));
        }
      }
    }
    return filteredSubjects.sort((a, b) => a.label.localeCompare(b.label));
  }, [allSubjects, templatesData, form.values, isEditMode]);

  const classes = useMemo(
    () =>
      (classesData?.data || [])
        .map((cls) => ({
          value: cls.id,
          label: cls.displayName || cls.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classesData],
  );

  const classSections = useMemo(
    () =>
      (classSectionsData?.data || [])
        .map((cs) => ({
          value: cs.id,
          label: `${cs.className} - ${cs.sectionName}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classSectionsData],
  );

  const subjectTemplates = useMemo(
    () =>
      (templatesData?.data || [])
        .map((template) => ({
          value: template.id,
          label: template.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [templatesData],
  );

  const sectionsForClass = useMemo(() => {
    if (isEditMode) return [];
    const createValues = form.values as CreateFormValues;
    if (createValues.mode === 'class-sections' && createValues.classId) {
      return (
        (classSectionsForClassData?.data || [])
          .map((cs) => ({
            value: cs.id,
            label: `${cs.className} - ${cs.sectionName}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))
      );
    }
    return [];
  }, [classSectionsForClassData, form.values, isEditMode]);

  const dataLoading =
    assessmentTypesLoading ||
    subjectsLoading ||
    classesLoading ||
    classSectionsLoading ||
    templatesLoading ||
    classSectionsForClassLoading;

  // Reset dependent fields when mode or class changes
  const currentMode = isEditMode ? undefined : (form.values as CreateFormValues).mode;
  const currentClassId = isEditMode ? undefined : (form.values as CreateFormValues).classId;

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

  // Type-safe form getInputProps helper
  const getInputProps = (field: keyof CreateFormValues | keyof UpdateFormValues) => {
    if (isEditMode) {
      return updateForm.getInputProps(field as keyof UpdateFormValues);
    }
    return createForm.getInputProps(field as keyof CreateFormValues);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)} onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault();
      }
    }}>
      <Stack gap="md">
        <TextInput label="Title" placeholder="Enter assessment title" required {...getInputProps('title')} />

        <Textarea
          label="Description"
          placeholder="Enter assessment description"
          minRows={3}
          {...getInputProps('description')}
        />

        <Select
          label="Assessment Type"
          placeholder="Select type"
          data={assessmentTypes}
          required
          {...getInputProps('assessmentTypeId')}
        />

        {!isEditMode && (
          <Stack gap="xs">
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Creation Mode</div>
            <Checkbox
              checked={createForm.values.mode === 'single'}
              label="Single Class Section"
              onChange={() => {
                createForm.setFieldValue('mode', 'single');
                createForm.setFieldValue('classSectionId', '');
                createForm.setFieldValue('classId', '');
                createForm.setFieldValue('subjectTemplateId', '');
                createForm.setFieldValue('classSectionIds', []);
                createForm.setFieldValue('subjectId', '');
              }}
            />
            <Checkbox
              checked={createForm.values.mode === 'class-template'}
              label="Class + Subject Template (All Sections)"
              onChange={() => {
                createForm.setFieldValue('mode', 'class-template');
                createForm.setFieldValue('classSectionId', '');
                createForm.setFieldValue('classId', '');
                createForm.setFieldValue('subjectTemplateId', '');
                createForm.setFieldValue('classSectionIds', []);
                createForm.setFieldValue('subjectId', '');
              }}
            />
            <Checkbox
              checked={createForm.values.mode === 'class-sections'}
              label="Class + Specific Sections"
              onChange={() => {
                createForm.setFieldValue('mode', 'class-sections');
                createForm.setFieldValue('classSectionId', '');
                createForm.setFieldValue('classId', '');
                createForm.setFieldValue('subjectTemplateId', '');
                createForm.setFieldValue('classSectionIds', []);
                createForm.setFieldValue('subjectId', '');
              }}
            />
          </Stack>
        )}

        {isEditMode ? (
          <>
            <Select
              label="Class Section"
              placeholder="Select class section"
              data={classSections}
              required
              {...getInputProps('classSectionId')}
            />
            <Select
              label="Subject"
              placeholder="Select subject"
              data={subjects}
              required
              {...getInputProps('subjectId')}
            />
          </>
        ) : (
          <>
            {(currentMode === 'single' || !currentMode) && (
              <>
                <Select
                  label="Class Section"
                  placeholder="Select class section"
                  data={classSections}
                  required
                  {...getInputProps('classSectionId')}
                />
                <Select
                  label="Subject"
                  placeholder="Select subject"
                  data={subjects}
                  required
                  {...getInputProps('subjectId')}
                />
              </>
            )}

            {currentMode === 'class-template' && (
              <>
                <Select
                  label="Class"
                  placeholder="Select class"
                  data={classes}
                  required
                  searchable
                  value={createForm.values.classId || null}
                  onChange={(value) => {
                    if (value !== createForm.values.classId) {
                      createForm.setFieldValue('classId', value || '');
                      createForm.setFieldValue('subjectTemplateId', '');
                      createForm.setFieldValue('subjectId', '');
                    }
                  }}
                />
                <Select
                  label="Subject Template"
                  placeholder="Select subject template"
                  data={subjectTemplates}
                  required
                  searchable
                  disabled={!currentClassId}
                  value={createForm.values.subjectTemplateId || null}
                  onChange={(value) => {
                    if (value !== createForm.values.subjectTemplateId) {
                      createForm.setFieldValue('subjectTemplateId', value || '');
                      createForm.setFieldValue('subjectId', '');
                    }
                  }}
                />
                <Select
                  label="Subject"
                  placeholder="Select subject"
                  data={subjects}
                  required
                  disabled={!createForm.values.subjectTemplateId}
                  {...getInputProps('subjectId')}
                />
              </>
            )}

            {currentMode === 'class-sections' && (
              <>
                <Select
                  label="Class"
                  placeholder="Select class"
                  data={classes}
                  required
                  searchable
                  value={createForm.values.classId || null}
                  onChange={(value) => {
                    if (value !== createForm.values.classId) {
                      createForm.setFieldValue('classId', value || '');
                      createForm.setFieldValue('classSectionIds', []);
                    }
                  }}
                />
                <MultiSelect
                  label="Class Sections"
                  placeholder="Select sections"
                  data={sectionsForClass}
                  required
                  searchable
                  disabled={!currentClassId}
                  value={createForm.values.classSectionIds || []}
                  onChange={(value) => {
                    createForm.setFieldValue('classSectionIds', value);
                  }}
                />
                <Select
                  label="Subject"
                  placeholder="Select subject"
                  data={subjects}
                  required
                  {...getInputProps('subjectId')}
                />
              </>
            )}
          </>
        )}

        <Group grow>
          <NumberInput
            label="Total Marks"
            placeholder="Enter total marks"
            min={0}
            required
            {...getInputProps('totalMarks')}
          />

          <DatePickerInput
            label="Due Date"
            placeholder="Select due date"
            leftSection={<IconCalendar size={16} />}
            {...getInputProps('dueDate')}
          />
        </Group>

        <DatePickerInput
          label="Publish Date"
          placeholder="Select publish date"
          leftSection={<IconCalendar size={16} />}
          {...getInputProps('publishDate')}
        />

        <Group>
          <Switch label="Published" {...getInputProps('isPublished')} />

          <Switch
            label="Allow Late Submission"
            {...getInputProps('allowLateSubmission')}
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

