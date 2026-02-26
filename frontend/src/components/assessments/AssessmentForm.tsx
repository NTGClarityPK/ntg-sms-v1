'use client';

/**
 * Assessment Form Component
 * Form for creating and editing assessments
 */

import { useTranslations } from 'next-intl';
import { useForm, zodResolver } from '@mantine/form';
import { Alert, Button, Stack, Text, TextInput, Textarea, NumberInput, Select, Switch, Group, Skeleton, Divider, MultiSelect, Checkbox, Progress } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconCalendar } from '@tabler/icons-react';
import { z } from 'zod';
import type { Assessment, CreateAssessmentInput, StagedDraftFile, UpdateAssessmentInput } from '@/types/assessment';
import { useAssessmentTypes } from '@/hooks/useAssessmentSettings';
import { useSubjects, useClasses } from '@/hooks/useCoreLookups';
import { useClassSections } from '@/hooks/useClassSections';
import { useTemplatesForClass, useClassesWithTemplates } from '@/hooks/useSubjectTemplates';
import { useMyStaff } from '@/hooks/useStaff';
import { useAssignmentsByTeacher } from '@/hooks/useTeacherAssignments';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { FileUpload } from './FileUpload';
import { FileUploadForCreate } from './FileUploadForCreate';

type CreationMode = 'single' | 'class-template' | 'class-sections';

// Optional UUID fields accept '' so validation doesn't fail before refine when user hasn't selected yet
const optionalUuid = () => z.union([z.string().uuid(), z.literal('')]).optional();
const createAssessmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assessmentTypeId: z.string().min(1, 'Select assessment type').pipe(z.string().uuid('Invalid assessment type')),
  subjectId: z.string().min(1, 'Select subject').pipe(z.string().uuid('Invalid subject')),
  mode: z.enum(['single', 'class-template', 'class-sections']),
  classSectionId: optionalUuid(),
  classId: optionalUuid(),
  subjectTemplateId: optionalUuid(),
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
}, (data) => {
  const msg = 'Please fill all required fields for the selected mode';
  if (data.mode === 'single') return { message: msg, path: ['classSectionId'] };
  if (data.mode === 'class-template') {
    if (!data.classId) return { message: msg, path: ['classId'] };
    return { message: msg, path: ['subjectTemplateId'] };
  }
  if (data.mode === 'class-sections') {
    if (!data.classId) return { message: msg, path: ['classId'] };
    return { message: msg, path: ['classSectionIds'] };
  }
  return { message: msg, path: ['classId'] };
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
  /** When set, show compression progress bar (0–100) and message. Button disabled during compression. */
  compressionProgress?: number | null;
  compressionMessage?: string;
  draftId?: string;
  stagedFiles?: StagedDraftFile[];
  onStagedFilesChange?: (files: StagedDraftFile[]) => void;
}

export function AssessmentForm({ assessment, onSubmit, isLoading, compressionProgress = null, compressionMessage, draftId = '', stagedFiles = [], onStagedFilesChange }: AssessmentFormProps) {
  const t = useTranslations('assessment');
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const isEditMode = !!assessment;
  const defaultCompressionMessage = compressionMessage ?? t('compressingMaterials');

  // Current user as staff (teacher) and their assignments for dropdown filtering
  const { data: myStaffResponse } = useMyStaff();
  const myStaff = myStaffResponse?.data ?? null;
  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYearId = activeYearResponse?.data?.id;
  const { data: teacherAssignments } = useAssignmentsByTeacher(myStaff?.id ?? null, activeYearId);
  const assignmentsList = teacherAssignments ?? [];
  const isTeacherWithAssignments = !!myStaff && assignmentsList.length > 0;
  const allowedSubjectIds = useMemo(
    () => new Set(assignmentsList.map((a) => a.subjectId)),
    [assignmentsList],
  );
  const allowedClassSectionIds = useMemo(
    () => new Set(assignmentsList.map((a) => a.classSectionId)),
    [assignmentsList],
  );

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

  // Subject IDs the teacher teaches in the selected class section(s) — used to filter subject dropdown (create mode only)
  const subjectIdsForSelectedClassSections = useMemo(() => {
    if (isEditMode || !isTeacherWithAssignments) return null;
    const createValues = createForm.values;
    if (createValues.mode === 'single' && createValues.classSectionId) {
      return new Set(
        assignmentsList
          .filter((a) => a.classSectionId === createValues.classSectionId)
          .map((a) => a.subjectId),
      );
    }
    if (createValues.mode === 'class-sections' && createValues.classSectionIds?.length) {
      const sectionSet = new Set(createValues.classSectionIds);
      return new Set(
        assignmentsList
          .filter((a) => sectionSet.has(a.classSectionId))
          .map((a) => a.subjectId),
      );
    }
    return null;
  }, [assignmentsList, isTeacherWithAssignments, isEditMode, createForm.values]);

  // Stable key for class section(s) so effect deps don't change on every render
  const classSectionKey = createForm.values.mode === 'single'
    ? createForm.values.classSectionId ?? ''
    : (createForm.values.classSectionIds ?? []).join(',');

  // Clear subject whenever class section(s) change so the dropdown never shows a stale selection
  useEffect(() => {
    if (isEditMode) return;
    if (createForm.values.mode === 'single' || createForm.values.mode === 'class-sections') {
      createForm.setFieldValue('subjectId', '');
    }
  }, [isEditMode, createForm.values.mode, classSectionKey]);

  // For class-level creation - must be after form declaration
  const selectedClassId = isEditMode ? undefined : (form.values as CreateFormValues).classId;
  const { data: templatesData, isLoading: templatesLoading } = useTemplatesForClass(
    selectedClassId || null,
    branchId || null,
  );
  const currentMode = isEditMode ? undefined : (form.values as CreateFormValues).mode;
  const currentClassId = isEditMode ? undefined : (form.values as CreateFormValues).classId;
  const { data: classSectionsForClassData, isLoading: classSectionsForClassLoading } = useClassSections({
    classId: selectedClassId,
    isActive: true,
    limit: 100,
    enabled: currentMode === 'class-sections' && !!selectedClassId,
  });
  const { data: classIdsWithTemplatesData } = useClassesWithTemplates(branchId || null, {
    enabled: currentMode === 'class-template',
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
        payload.classSectionId = createValues.classSectionId || undefined;
      } else if (createValues.mode === 'class-template') {
        payload.classId = createValues.classId || undefined;
        payload.subjectTemplateId = createValues.subjectTemplateId || undefined;
      } else if (createValues.mode === 'class-sections') {
        payload.classId = createValues.classId || undefined;
        payload.classSectionIds =
          createValues.classSectionIds?.length ? createValues.classSectionIds : undefined;
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

  const allSubjects = useMemo(() => {
    const list =
      subjectsData?.data?.map((subject) => ({
        value: subject.id,
        label: subject.name,
      })) || [];
    if (isTeacherWithAssignments) {
      return list.filter((s) => allowedSubjectIds.has(s.value));
    }
    return list;
  }, [subjectsData, isTeacherWithAssignments, allowedSubjectIds]);

  // Filter subjects based on mode and (for teachers) selected class section(s)
  const subjects = useMemo(() => {
    let filteredSubjects = allSubjects;
    if (!isEditMode) {
      const createValues = form.values as CreateFormValues;
      // Single class section: for teachers, only show subjects assigned to that class section; require class section selected first
      if (createValues.mode === 'single' && isTeacherWithAssignments) {
        if (createValues.classSectionId && subjectIdsForSelectedClassSections) {
          filteredSubjects = allSubjects.filter((s) => subjectIdsForSelectedClassSections.has(s.value));
        } else {
          filteredSubjects = [];
        }
      } else if (createValues.mode === 'class-sections' && isTeacherWithAssignments) {
        // Class + specific sections: for teachers, only show subjects assigned to any selected section
        if (createValues.classSectionIds?.length && subjectIdsForSelectedClassSections) {
          filteredSubjects = allSubjects.filter((s) => subjectIdsForSelectedClassSections.has(s.value));
        } else {
          filteredSubjects = [];
        }
      } else if (createValues.mode === 'class-template' && createValues.subjectTemplateId) {
        const selectedTemplate = templatesData?.data?.find(
          (t) => t.id === createValues.subjectTemplateId,
        );
        if (selectedTemplate?.subjectIds) {
          filteredSubjects = allSubjects.filter((s) => selectedTemplate.subjectIds.includes(s.value));
        }
      }
    }
    return filteredSubjects.sort((a, b) => a.label.localeCompare(b.label));
  }, [allSubjects, templatesData, form.values, isEditMode, isTeacherWithAssignments, subjectIdsForSelectedClassSections]);

  const classes = useMemo(() => {
    let list = (classesData?.data || []).map((cls) => ({
      value: cls.id,
      label: cls.displayName || cls.name,
    }));
    if (isTeacherWithAssignments) {
      const allowedClassIds = new Set(
        (classSectionsData?.data || [])
          .filter((cs) => allowedClassSectionIds.has(cs.id))
          .map((cs) => cs.classId),
      );
      list = list.filter((c) => allowedClassIds.has(c.value));
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [classesData, classSectionsData, isTeacherWithAssignments, allowedClassSectionIds]);

  // For "Class + Subject Template (All Sections)" only show classes that have at least one subject template assigned
  const classIdsWithTemplatesSet = useMemo(
    () => new Set(classIdsWithTemplatesData ?? []),
    [classIdsWithTemplatesData],
  );
  const classesForTemplateMode = useMemo(
    () => classes.filter((c) => classIdsWithTemplatesSet.has(c.value)),
    [classes, classIdsWithTemplatesSet],
  );

  const classSections = useMemo(() => {
    let list = (classSectionsData?.data || [])
      .map((cs) => ({
        value: cs.id,
        label: `${cs.className} - ${cs.sectionName}`,
      }));
    if (isTeacherWithAssignments) {
      list = list.filter((cs) => allowedClassSectionIds.has(cs.value));
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [classSectionsData, isTeacherWithAssignments, allowedClassSectionIds]);

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
      let list = (classSectionsForClassData?.data || []).map((cs) => ({
        value: cs.id,
        label: `${cs.className} - ${cs.sectionName}`,
      }));
      if (isTeacherWithAssignments) {
        list = list.filter((cs) => allowedClassSectionIds.has(cs.value));
      }
      return list.sort((a, b) => a.label.localeCompare(b.label));
    }
    return [];
  }, [classSectionsForClassData, form.values, isEditMode, isTeacherWithAssignments, allowedClassSectionIds]);

  // Only block entire form on initial lookup data; dependent data (templates/sections for selected class) must not replace the form
  const initialDataLoading =
    assessmentTypesLoading ||
    subjectsLoading ||
    classesLoading ||
    classSectionsLoading;
  const dependentDataLoading =
    (currentMode === 'class-template' && !!currentClassId && templatesLoading) ||
    (currentMode === 'class-sections' && !!currentClassId && classSectionsForClassLoading);

  if (initialDataLoading) {
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

  const createFormErrors = !isEditMode ? (createForm.errors as Record<string, string>) : {};
  const hasCreateErrors = Object.keys(createFormErrors).length > 0;
  const firstCreateError =
    createFormErrors.title ||
    createFormErrors.assessmentTypeId ||
    createFormErrors.subjectId ||
    createFormErrors.classSectionId ||
    createFormErrors.classId ||
    createFormErrors.subjectTemplateId ||
    createFormErrors.classSectionIds ||
    createFormErrors._root ||
    t('pleaseCompleteRequired');

  return (
    <form
      id="assessment-form"
      onSubmit={form.onSubmit(handleSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
          e.preventDefault();
        }
      }}
    >
      <Stack gap="md">
        {hasCreateErrors && (
          <Alert variant="light" color="red" title={t('cannotCreateYet')}>
            {firstCreateError}
          </Alert>
        )}
        <TextInput id="assessment-form-title" label={t('titleColumn')} placeholder={t('titlePlaceholder')} required {...getInputProps('title')} />

        <Textarea
          id="assessment-form-description"
          label={t('description')}
          placeholder={t('descriptionPlaceholder')}
          minRows={3}
          {...getInputProps('description')}
        />

        <Select
          id="assessment-form-type"
          label={t('assessmentType')}
          placeholder={t('selectType')}
          data={assessmentTypes}
          required
          {...getInputProps('assessmentTypeId')}
        />

        {!isEditMode && (
          <Stack gap="xs">
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>{t('creationMode')}</div>
            <Checkbox
              checked={createForm.values.mode === 'single'}
              label={t('singleClassSection')}
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
              label={t('classSubjectTemplateAll')}
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
              label={t('classSpecificSections')}
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
              label={t('classSection')}
              placeholder={t('selectClassSection')}
              data={classSections}
              required
              {...getInputProps('classSectionId')}
            />
            <Select
              label={t('subject')}
              placeholder={t('selectSubject')}
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
                  label={t('classSection')}
                  placeholder={t('selectClassSection')}
                  data={classSections}
                  required
                  {...getInputProps('classSectionId')}
                  onChange={(value) => {
                    createForm.setFieldValue('classSectionId', value || '');
                    createForm.setFieldValue('subjectId', '');
                  }}
                />
                <Select
                  key={`subject-single-${createForm.values.classSectionId || 'none'}`}
                  label={t('subject')}
                  placeholder={createForm.values.classSectionId ? t('selectSubject') : t('selectClassSectionFirst')}
                  data={subjects}
                  required
                  disabled={!createForm.values.classSectionId}
                  {...getInputProps('subjectId')}
                />
              </>
            )}

            {currentMode === 'class-template' && (
              <>
                <Select
                  label={t('class')}
                  placeholder={t('selectClass')}
                  data={classesForTemplateMode}
                  required
                  searchable
                  error={createForm.errors.classId}
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
                  label={t('subjectTemplate')}
                  placeholder={dependentDataLoading && currentMode === 'class-template' ? t('loading') : t('selectSubjectTemplate')}
                  data={subjectTemplates}
                  required
                  searchable
                  disabled={!currentClassId || (currentMode === 'class-template' && !!currentClassId && templatesLoading)}
                  error={createForm.errors.subjectTemplateId}
                  value={createForm.values.subjectTemplateId || null}
                  onChange={(value) => {
                    if (value !== createForm.values.subjectTemplateId) {
                      createForm.setFieldValue('subjectTemplateId', value || '');
                      createForm.setFieldValue('subjectId', '');
                    }
                  }}
                />
                <Select
                  label={t('subject')}
                  placeholder={t('selectSubject')}
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
                  label={t('class')}
                  placeholder={t('selectClass')}
                  data={classes}
                  required
                  searchable
                  error={createForm.errors.classId}
                  value={createForm.values.classId || null}
                  onChange={(value) => {
                    if (value !== createForm.values.classId) {
                      createForm.setFieldValue('classId', value || '');
                      createForm.setFieldValue('classSectionIds', []);
                    }
                  }}
                />
                <MultiSelect
                  label={t('classSections')}
                  placeholder={dependentDataLoading && currentMode === 'class-sections' ? t('loading') : t('selectSections')}
                  data={sectionsForClass}
                  required
                  searchable
                  disabled={!currentClassId || (currentMode === 'class-sections' && !!currentClassId && classSectionsForClassLoading)}
                  error={createForm.errors.classSectionIds}
                  value={createForm.values.classSectionIds || []}
                  onChange={(value) => {
                    createForm.setFieldValue('classSectionIds', value);
                    createForm.setFieldValue('subjectId', '');
                  }}
                />
                <Select
                  key={`subject-sections-${(createForm.values.classSectionIds || []).join(',') || 'none'}`}
                  label={t('subject')}
                  placeholder={(createForm.values.classSectionIds?.length ?? 0) > 0 ? t('selectSubject') : t('selectClassSectionsFirst')}
                  data={subjects}
                  required
                  disabled={!(createForm.values.classSectionIds?.length)}
                  {...getInputProps('subjectId')}
                />
              </>
            )}
          </>
        )}

        <Group grow>
          <NumberInput
            id="assessment-form-total-marks"
            label={t('totalMarks')}
            placeholder={t('enterTotalMarks')}
            min={0}
            required
            {...getInputProps('totalMarks')}
          />

          <DatePickerInput
            id="assessment-form-due-date"
            label={t('dueDate')}
            placeholder={t('selectDueDate')}
            leftSection={<IconCalendar size={16} />}
            {...getInputProps('dueDate')}
          />
        </Group>

        <DatePickerInput
          id="assessment-form-publish-date"
          label={t('publishDate')}
          placeholder={t('selectPublishDate')}
          leftSection={<IconCalendar size={16} />}
          {...getInputProps('publishDate')}
        />

        <Group>
          <Switch id="assessment-form-published" label={t('published')} {...getInputProps('isPublished')} />

          <Switch
            id="assessment-form-allow-late"
            label={t('allowLateSubmission')}
            {...getInputProps('allowLateSubmission')}
          />
        </Group>

        <Divider my="md" />
        {assessment?.id ? (
          <FileUpload assessmentId={assessment.id} />
        ) : (
          <>
            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
              {t('optionalMaterials')}
            </div>
            <FileUploadForCreate
              draftId={draftId}
              stagedFiles={stagedFiles}
              onStagedFilesChange={onStagedFilesChange || (() => {})}
            />
          </>
        )}

        {compressionProgress !== null && compressionProgress !== undefined && (
          <Stack gap="xs" mt="md">
            <Text size="sm" c="dimmed">
              {compressionMessage ?? defaultCompressionMessage}
              {compressionProgress < 100 ? ` ${Math.round(compressionProgress)}%` : ''}
            </Text>
            <Progress value={compressionProgress} size="lg" radius="xl" />
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button
            id="assessment-form-submit"
            type="submit"
            loading={isLoading}
            disabled={compressionProgress !== null && compressionProgress !== undefined}
          >
            {assessment ? t('updateAssessment') : t('createAssessment')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

