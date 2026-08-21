'use client';

import { useEffect, useMemo } from 'react';
import { Modal, Select, Button, Stack, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import {
  useCreateTeacherAssignment,
  useUpdateTeacherAssignment,
} from '@/hooks/useTeacherAssignments';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { useClassSections } from '@/hooks/useClassSections';
import { useSubjects, useLevels } from '@/hooks/useCoreLookups';
import { useStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import { useSubjectTemplates } from '@/hooks/useSubjectTemplates';
import {
  buildSubjectApplicabilityIndex,
  isSubjectApplicableToClass,
} from '@/lib/utils/subject-eligibility';
import type { Level } from '@/types/settings';
import type { SubjectTemplate } from '@/types/subject-templates';

const createAssignmentSchema = (t: (key: string) => string) =>
  z.object({
    classSectionId: z.string().min(1, t('classSectionRequired')),
    subjectId: z.string().min(1, t('subjectRequired')),
    staffId: z.string().min(1, t('teacherRequired')),
  });

interface CreateAssignmentModalProps {
  opened: boolean;
  onClose: () => void;
  assignment?: TeacherAssignment | null;
}

export function CreateAssignmentModal({
  opened,
  onClose,
  assignment,
}: CreateAssignmentModalProps) {
  const t = useTranslations('teacher');
  const isEdit = !!assignment;
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id ?? null;
  const createAssignment = useCreateTeacherAssignment();
  const updateAssignment = useUpdateTeacherAssignment();
  const { data: classSectionsData } = useClassSections();
  const { data: subjectsData } = useSubjects();
  const { data: levelsResponse } = useLevels();
  const { data: templatesResponse } = useSubjectTemplates(branchId, 1, 100);
  const { data: staffData } = useStaff();

  const classSections = classSectionsData?.data || [];
  const subjects = subjectsData?.data || [];
  const levels = (levelsResponse?.data ?? []) as Level[];
  const templates = (templatesResponse?.data ?? []) as SubjectTemplate[];
  const subjectApplicability = useMemo(
    () => buildSubjectApplicabilityIndex(templates, levels),
    [templates, levels],
  );
  const staffResponse = staffData as
    | {
        data?: Array<{
          id: string;
          fullName?: string | null;
          employeeId?: string | null;
          isActive: boolean;
          roles?: Array<{ roleName: string }>;
        }>;
      }
    | null
    | undefined;
  const staff = staffResponse?.data || [];

  const form = useForm({
    initialValues: {
      classSectionId: '',
      subjectId: '',
      staffId: '',
    },
    validate: zodResolver(createAssignmentSchema(t)),
  });

  // Reset form when assignment prop changes (for edit mode)
  useEffect(() => {
    if (assignment) {
      form.setValues({
        classSectionId: assignment.classSectionId,
        subjectId: assignment.subjectId,
        staffId: assignment.staffId,
      });
    } else {
      form.reset();
    }
  }, [assignment]);

  // Clear subject when class-section changes and current subject is not applicable
  useEffect(() => {
    if (isEdit || !form.values.classSectionId || !form.values.subjectId) return;
    const classSection = classSections.find((cs) => cs.id === form.values.classSectionId);
    if (!classSection) return;
    if (
      !isSubjectApplicableToClass(
        subjectApplicability,
        classSection.classId,
        form.values.subjectId,
      )
    ) {
      form.setFieldValue('subjectId', '');
    }
  }, [
    form.values.classSectionId,
    form.values.subjectId,
    classSections,
    subjectApplicability,
    isEdit,
  ]);

  const handleSubmit = async (values: typeof form.values) => {
    if (isEdit) {
      await updateAssignment.mutateAsync({
        id: assignment!.id,
        input: {
          staffId: values.staffId,
        },
      });
    } else {
      await createAssignment.mutateAsync({
        classSectionId: values.classSectionId,
        subjectId: values.subjectId,
        staffId: values.staffId,
      });
    }
    form.reset();
    onClose();
  };

  const classSectionOptions = classSections.map((cs) => ({
    value: cs.id,
    label: `${cs.classDisplayName || cs.className || t('unknown')} - ${cs.sectionName || t('unknown')}`,
  }));

  const selectedClassSection = classSections.find((cs) => cs.id === form.values.classSectionId);
  const subjectOptions = subjects
    .filter((s) => {
      if (!selectedClassSection) return true;
      return isSubjectApplicableToClass(
        subjectApplicability,
        selectedClassSection.classId,
        s.id,
      );
    })
    .map((s) => ({
      value: s.id,
      label: s.name,
    }));

  // Filter to only include active staff with teacher roles (class_teacher or subject_teacher)
  const staffOptions = staff
    .filter((s) => {
      if (!s.isActive) return false;
      // Check if staff has teacher roles
      const hasTeacherRole = s.roles?.some(
        (r: any) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher'
      );
      return hasTeacherRole;
    })
    .map((s) => ({
      value: s.id,
      label: s.fullName || s.employeeId || t('unknown'),
    }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? t('editAssignmentTitle') : t('createAssignmentTitle')}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <Select
                label={t('classSection')}
                placeholder={t('selectClassSection')}
                data={classSectionOptions}
                required
                searchable
                {...form.getInputProps('classSectionId')}
              />
              <Select
                label={t('subject')}
                placeholder={t('selectSubject')}
                description={
                  selectedClassSection && subjectOptions.length === 0
                    ? t('subjectNotOnClassCurriculum')
                    : undefined
                }
                data={subjectOptions}
                required
                searchable
                disabled={!form.values.classSectionId}
                {...form.getInputProps('subjectId')}
              />
            </>
          )}
          <Select
            label={t('teacher')}
            placeholder={t('selectTeacher')}
            data={staffOptions}
            required
            searchable
            {...form.getInputProps('staffId')}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="submit"
            loading={createAssignment.isPending || updateAssignment.isPending}
          >
            {isEdit ? t('update') : t('create')}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

