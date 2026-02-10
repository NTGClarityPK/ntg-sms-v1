'use client';

import { useEffect } from 'react';
import { Modal, Select, Button, Stack, Group, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateOrUpdateSlot } from '@/hooks/useTimetable';
import type { TimetableSlot, TimetableSlotType } from '@/types/timetable';
import { useTeacherAssignments } from '@/hooks/useTeacherAssignments';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useStaff } from '@/hooks/useStaff';

const slotSchema = z.object({
  subjectId: z.string().optional(),
  staffId: z.string().optional(),
  room: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  slotType: z.enum(['class', 'assembly', 'break']),
}).refine((data) => {
  if (data.slotType === 'class' && !data.subjectId) {
    return false;
  }
  return true;
}, {
  message: 'Subject is required for class slots',
  path: ['subjectId'],
}).refine((data) => {
  const start = data.startTime.split(':').map(Number);
  const end = data.endTime.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  return startMinutes < endMinutes;
}, {
  message: 'Start time must be before end time',
  path: ['endTime'],
});

interface SlotEditModalProps {
  opened: boolean;
  onClose: () => void;
  slot?: TimetableSlot | null;
  classSectionId: string;
  dayOfWeek: number;
  periodNumber: number;
  academicYearId?: string;
}

export function SlotEditModal({
  opened,
  onClose,
  slot,
  classSectionId,
  dayOfWeek,
  periodNumber,
  academicYearId,
}: SlotEditModalProps) {
  const isEdit = !!slot;
  const createOrUpdate = useCreateOrUpdateSlot();
  const { data: assignmentsData } = useTeacherAssignments({ classSectionId });
  const { data: subjectsData } = useSubjects();
  const { data: staffData } = useStaff();

  const assignments = assignmentsData?.data || [];
  const subjects = subjectsData?.data || [];
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
      subjectId: '',
      staffId: '',
      room: '',
      startTime: '',
      endTime: '',
      slotType: 'class' as TimetableSlotType,
    },
    validate: zodResolver(slotSchema),
  });

  // CRITICAL: Pre-populate form when slot prop changes (for editing)
  useEffect(() => {
    if (slot) {
      form.setValues({
        subjectId: slot.subjectId || '',
        staffId: slot.staffId || '',
        room: slot.room || '',
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
      });
    } else {
      form.reset();
    }
  }, [slot]);

  const handleSubmit = async (values: typeof form.values) => {
    await createOrUpdate.mutateAsync({
      classSectionId,
      dayOfWeek,
      periodNumber,
      subjectId: values.subjectId || undefined,
      staffId: values.staffId || undefined,
      room: values.room || undefined,
      startTime: values.startTime,
      endTime: values.endTime,
      slotType: values.slotType,
      academicYearId,
    });
    form.reset();
    onClose();
  };

  // Get subjects assigned to this class-section
  const classSectionSubjectIds = new Set(
    assignments.map((a) => a.subjectId),
  );
  const subjectOptions = subjects
    .filter((s) => classSectionSubjectIds.has(s.id))
    .map((s) => ({
      value: s.id,
      label: s.name,
    }));

  // Get teachers assigned to selected subject
  const selectedSubjectAssignments = form.values.subjectId
    ? assignments.filter((a) => a.subjectId === form.values.subjectId)
    : [];
  const teacherIds = new Set(
    selectedSubjectAssignments.map((a) => a.staffId),
  );
  const staffOptions = staff
    .filter((s) => {
      if (!s.isActive) return false;
      if (form.values.subjectId && !teacherIds.has(s.id)) return false;
      const hasTeacherRole = s.roles?.some(
        (r: any) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher',
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
      title={isEdit ? 'Edit Timetable Slot' : 'Create Timetable Slot'}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Slot Type"
            data={[
              { value: 'class', label: 'Class' },
              { value: 'assembly', label: 'Assembly' },
              { value: 'break', label: 'Break' },
            ]}
            required
            {...form.getInputProps('slotType')}
          />
          {form.values.slotType === 'class' && (
            <>
              <Select
                label="Subject"
                placeholder="Select subject"
                data={subjectOptions}
                required
                searchable
                {...form.getInputProps('subjectId')}
              />
              {form.values.subjectId && (
                <Select
                  label="Teacher"
                  placeholder="Select teacher"
                  data={staffOptions}
                  searchable
                  {...form.getInputProps('staffId')}
                />
              )}
            </>
          )}
          <TextInput
            label="Room"
            placeholder="Optional room number"
            {...form.getInputProps('room')}
          />
          <TextInput
            label="Start Time"
            type="time"
            required
            {...form.getInputProps('startTime')}
          />
          <TextInput
            label="End Time"
            type="time"
            required
            {...form.getInputProps('endTime')}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createOrUpdate.isPending}>
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

