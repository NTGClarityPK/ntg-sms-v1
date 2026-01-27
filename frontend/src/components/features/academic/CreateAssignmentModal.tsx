'use client';

import { useEffect } from 'react';
import { Modal, Select, Button, Stack, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import {
  useCreateTeacherAssignment,
  useUpdateTeacherAssignment,
} from '@/hooks/useTeacherAssignments';
import type { TeacherAssignment } from '@/types/teacher-assignments';
import { useClassSections } from '@/hooks/useClassSections';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useStaff } from '@/hooks/useStaff';

const createAssignmentSchema = z.object({
  classSectionId: z.string().min(1, 'Class-section is required'),
  subjectId: z.string().min(1, 'Subject is required'),
  staffId: z.string().min(1, 'Teacher is required'),
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
  const isEdit = !!assignment;
  const createAssignment = useCreateTeacherAssignment();
  const updateAssignment = useUpdateTeacherAssignment();
  const { data: classSectionsData } = useClassSections();
  const { data: subjectsData } = useSubjects();
  const { data: staffData } = useStaff();

  const classSections = classSectionsData?.data || [];
  const subjects = subjectsData?.data || [];
  const staffResponse = staffData;
  const staff = (staffResponse && 'data' in staffResponse ? staffResponse.data : []) as any[];

  const form = useForm({
    initialValues: {
      classSectionId: '',
      subjectId: '',
      staffId: '',
    },
    validate: zodResolver(createAssignmentSchema),
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
    label: `${cs.classDisplayName || cs.className || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
  }));

  const subjectOptions = subjects.map((s) => ({
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
      label: s.fullName || s.employeeId || 'Unknown',
    }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Edit Teacher Assignment' : 'Create Teacher Assignment'}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <Select
                label="Class-Section"
                placeholder="Select class-section"
                data={classSectionOptions}
                required
                searchable
                {...form.getInputProps('classSectionId')}
              />
              <Select
                label="Subject"
                placeholder="Select subject"
                data={subjectOptions}
                required
                searchable
                {...form.getInputProps('subjectId')}
              />
            </>
          )}
          <Select
            label="Teacher"
            placeholder="Select teacher"
            data={staffOptions}
            required
            searchable
            {...form.getInputProps('staffId')}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createAssignment.isPending || updateAssignment.isPending}
          >
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

