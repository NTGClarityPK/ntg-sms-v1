'use client';

import { Button, Group, Modal, MultiSelect, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useClasses } from '@/hooks/useCoreLookups';
import { useLevels } from '@/hooks/useCoreLookups';
import type { SubjectTemplate } from '@/types/subject-templates';
import { useTranslations } from 'next-intl';

export interface SubjectTemplateFormValues {
  name: string;
  description?: string;
  subjectIds: string[];
  classIds: string[];
  levelIds: string[];
}

interface SubjectTemplateFormProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: SubjectTemplateFormValues) => Promise<void>;
  isSubmitting: boolean;
  entity?: SubjectTemplate | null;
}

export function SubjectTemplateForm({
  opened,
  onClose,
  onSubmit,
  isSubmitting,
  entity,
}: SubjectTemplateFormProps) {
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const form = useForm<SubjectTemplateFormValues>({
    initialValues: {
      name: '',
      description: '',
      subjectIds: [],
      classIds: [],
      levelIds: [],
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('subjectTemplateFormNameRequired') : null),
      classIds: (_, values) =>
        (values.classIds?.length ?? 0) === 0 && (values.levelIds?.length ?? 0) === 0
          ? tSettings('subjectTemplateFormAssignRequired')
          : null,
      levelIds: (_, values) =>
        (values.classIds?.length ?? 0) === 0 && (values.levelIds?.length ?? 0) === 0
          ? tSettings('subjectTemplateFormAssignRequired')
          : null,
    },
  });

  useEffect(() => {
    if (entity) {
      form.setValues({
        name: entity.name,
        description: entity.description ?? '',
        subjectIds: entity.subjectIds ?? [],
        classIds: entity.assignedClassIds ?? [],
        levelIds: entity.assignedLevelIds ?? [],
      });
    } else {
      form.reset();
    }
  }, [entity]);

  const subjectsQuery = useSubjects();
  const classesQuery = useClasses();
  const levelsQuery = useLevels();

  const subjectOptions =
    subjectsQuery.data?.data?.map((s) => ({ value: s.id, label: s.name })) ?? [];
  const classOptions =
    classesQuery.data?.data?.map((c) => ({ value: c.id, label: c.displayName || c.name })) ?? [];
  const levelOptions =
    levelsQuery.data?.data?.map((l) => ({ value: l.id, label: l.name })) ?? [];

  const submit = form.onSubmit(async (values) => {
    await onSubmit({
      ...values,
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
    });
    if (!entity) {
      form.reset();
    }
    onClose();
  });

  const hasClassesSelected = form.values.classIds.length > 0;
  const hasLevelsSelected = form.values.levelIds.length > 0;
  const classesDisabled = hasLevelsSelected;
  const levelsDisabled = hasClassesSelected;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={entity ? tSettings('subjectTemplateFormModalEdit') : tSettings('subjectTemplateFormModalCreate')}
      size="lg"
    >
      <form id="subject-template-form" onSubmit={submit}>
        <Stack gap="md">
          <TextInput
            id="subject-template-form-name"
            label={tSettings('subjectTemplateFormNameLabel')}
            description={tSettings('subjectTemplateFormNameDescription')}
            placeholder={tSettings('subjectTemplateFormNamePlaceholder')}
            required
            {...form.getInputProps('name')}
          />
          <Textarea
            id="subject-template-form-description"
            label={tSettings('subjectTemplateFormDescLabel')}
            description={tSettings('subjectTemplateFormDescDescription')}
            placeholder={tSettings('subjectTemplateFormDescPlaceholder')}
            {...form.getInputProps('description')}
          />

          <MultiSelect
            id="subject-template-form-subjects"
            label={tSettings('subjectTemplateFormSubjectsLabel')}
            description={tSettings('subjectTemplateFormSubjectsDescription')}
            placeholder={tSettings('subjectTemplateFormSubjectsPlaceholder')}
            data={subjectOptions}
            {...form.getInputProps('subjectIds')}
            searchable
          />

          <MultiSelect
            id="subject-template-form-classes"
            label={tSettings('subjectTemplateFormClassesLabel')}
            description={tSettings('subjectTemplateFormClassesDescription')}
            placeholder={tSettings('subjectTemplateFormClassesPlaceholder')}
            data={classOptions}
            disabled={classesDisabled}
            value={form.values.classIds}
            onChange={(next) => {
              form.setFieldValue('classIds', next);
              if (next.length > 0 && form.values.levelIds.length > 0) {
                form.setFieldValue('levelIds', []);
              }
            }}
            error={form.errors.classIds}
            searchable
          />

          <MultiSelect
            id="subject-template-form-levels"
            label={tSettings('subjectTemplateFormLevelsLabel')}
            description={tSettings('subjectTemplateFormLevelsDescription')}
            placeholder={tSettings('subjectTemplateFormLevelsPlaceholder')}
            data={levelOptions}
            disabled={levelsDisabled}
            value={form.values.levelIds}
            onChange={(next) => {
              form.setFieldValue('levelIds', next);
              if (next.length > 0 && form.values.classIds.length > 0) {
                form.setFieldValue('classIds', []);
              }
            }}
            error={form.errors.levelIds}
            searchable
          />

          <Group justify="flex-end" mt="md">
            <Button id="subject-template-form-cancel" variant="light" onClick={onClose} disabled={isSubmitting}>
              {tCommon('cancel')}
            </Button>
            <Button id="subject-template-form-submit" type="submit" loading={isSubmitting}>
              {entity ? tCommon('update') : tCommon('create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
