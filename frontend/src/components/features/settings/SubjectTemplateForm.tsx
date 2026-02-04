'use client';

import { Button, Group, Modal, MultiSelect, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useClasses } from '@/hooks/useCoreLookups';
import { useLevels } from '@/hooks/useCoreLookups';
import type { SubjectTemplate } from '@/types/subject-templates';

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
  const form = useForm<SubjectTemplateFormValues>({
    initialValues: {
      name: '',
      description: '',
      subjectIds: [],
      classIds: [],
      levelIds: [],
    },
    validate: {
      name: (v) => (v.trim().length === 0 ? 'Name is required' : null),
      classIds: (_, values) =>
        (values.classIds?.length ?? 0) === 0 && (values.levelIds?.length ?? 0) === 0
          ? 'Assign to at least one class or one level'
          : null,
      levelIds: (_, values) =>
        (values.classIds?.length ?? 0) === 0 && (values.levelIds?.length ?? 0) === 0
          ? 'Assign to at least one class or one level'
          : null,
    },
  });

  // Sync form when entity changes (for edit mode)
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
      title={entity ? 'Edit Subject Template' : 'Create Subject Template'}
      size="lg"
    >
      <form onSubmit={submit}>
        <Stack gap="md">
          <TextInput label="Name" placeholder="Science Group" required {...form.getInputProps('name')} />
          <Textarea
            label="Description"
            placeholder="Template for science stream students"
            {...form.getInputProps('description')}
          />

          <MultiSelect
            label="Subjects"
            placeholder="Select subjects"
            data={subjectOptions}
            {...form.getInputProps('subjectIds')}
            searchable
          />

          <MultiSelect
            label="Assign to Classes"
            placeholder="Select classes"
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
            label="Assign to Levels"
            placeholder="Select levels"
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
            <Button variant="light" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {entity ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

