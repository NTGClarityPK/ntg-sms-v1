'use client';

import { useEffect, useState } from 'react';
import { Select, Button, Stack, Group, TextInput, Alert, Text, Paper } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { IconAlertCircle, IconX } from '@tabler/icons-react';
import { useCreateOrUpdateSlot, useDeleteSlot, useTimingTemplateInfo } from '@/hooks/useTimetable';
import type { TimetableSlot, TimetableSlotType } from '@/types/timetable';
import { useTeacherAssignments } from '@/hooks/useTeacherAssignments';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useStaff } from '@/hooks/useStaff';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useSubjectTemplate } from '@/hooks/useSubjectTemplates';
import { useSchoolDays } from '@/hooks/useScheduleSettings';
import { MultiSelect } from '@mantine/core';

const slotSchema = z
  .object({
    subjectId: z.string().optional(),
    staffId: z.string().optional(),
    room: z.string().optional(),
    periodNumber: z
      .string()
      .optional()
      .refine(
        (val) => !val || (!Number.isNaN(Number(val)) && Number(val) >= 1),
        'Period number must be a positive number',
      ),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    slotType: z.enum(['class', 'assembly', 'break']),
  })
  .refine((data) => {
    if (data.slotType === 'class' && !data.subjectId) {
      return false;
    }
    return true;
  }, {
    message: 'Subject is required for class slots',
    path: ['subjectId'],
  })
  .refine((data) => {
    const start = data.startTime.split(':').map(Number);
    const end = data.endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return startMinutes < endMinutes;
  }, {
    message: 'Start time must be before end time',
    path: ['endTime'],
  });

interface SlotEditPopoverProps {
  opened: boolean;
  onClose: () => void;
  target: HTMLElement | null;
  slot?: TimetableSlot | null;
  classSectionId: string;
  dayOfWeek: number;
  timeRange: string; // Format: "HH:MM:SS-HH:MM:SS" or empty string
  academicYearId?: string;
  subjectTemplateId?: string;
  onConflictCheck?: (slot: Partial<CreateTimetableSlotInput>) => Promise<boolean>;
}

type CreateTimetableSlotInput = {
  classSectionId: string;
  dayOfWeek: number;
  periodNumber?: number; // Optional label
  startTime: string;
  endTime: string;
  subjectId?: string;
  staffId?: string;
  room?: string;
  slotType: TimetableSlotType;
  academicYearId?: string;
};

export function SlotEditPopover({
  opened,
  onClose,
  target,
  slot,
  classSectionId,
  dayOfWeek,
  timeRange,
  academicYearId,
  subjectTemplateId,
  onConflictCheck,
}: SlotEditPopoverProps) {
  const isEdit = !!slot;
  const colors = useThemeColors();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { data: activeYear } = useActiveAcademicYear();
  const createOrUpdate = useCreateOrUpdateSlot();
  const deleteSlot = useDeleteSlot();
  const { data: assignmentsData } = useTeacherAssignments({ classSectionId });
  const { data: subjectsData } = useSubjects();
  const { data: staffData } = useStaff();
  const { data: templateInfoData } = useTimingTemplateInfo(classSectionId);
  const { data: templateData } = useSubjectTemplate(
    subjectTemplateId ?? null,
    branchId ?? null,
  );
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [isCheckingConflict, setIsCheckingConflict] = useState(false);
  
  const templateInfo = templateInfoData;
  // useSubjectTemplate returns SubjectTemplate as query data (already unwrapped)
  const subjectTemplate = templateData;

  const assignments = assignmentsData?.data || [];
  const subjects = (subjectsData as { data?: Array<{ id: string; name: string }> })?.data || [];
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

  const { data: schoolDaysData } = useSchoolDays();
  const activeSchoolDays = schoolDaysData?.data || [];
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOptions = activeSchoolDays
    .filter((d) => d !== dayOfWeek) // Exclude current day
    .map((d) => ({
      value: String(d),
      label: dayNames[d] || `Day ${d}`,
    }));

  const form = useForm({
    initialValues: {
      subjectId: '',
      staffId: '',
      room: '',
      periodNumber: '',
      startTime: '',
      endTime: '',
      slotType: 'class' as TimetableSlotType,
      additionalDays: [] as string[], // For multi-day creation
    },
    validate: zodResolver(slotSchema),
  });

  // When subject has exactly one assigned teacher, fix that teacher (no dropdown)
  const selectedSubjectAssignmentsForEffect = form.values.subjectId
    ? assignments.filter((a) => a.subjectId === form.values.subjectId)
    : [];
  const singleTeacherId =
    selectedSubjectAssignmentsForEffect.length === 1
      ? selectedSubjectAssignmentsForEffect[0].staffId
      : null;

  useEffect(() => {
    if (form.values.slotType !== 'class' || !form.values.subjectId) return;
    if (singleTeacherId && form.values.staffId !== singleTeacherId) {
      form.setFieldValue('staffId', singleTeacherId);
    }
    if (!singleTeacherId && selectedSubjectAssignmentsForEffect.length === 0) {
      form.setFieldValue('staffId', '');
    }
  }, [form.values.subjectId, form.values.slotType, singleTeacherId, selectedSubjectAssignmentsForEffect.length]);

  // CRITICAL: Pre-populate form when slot prop changes (for editing) or timeRange changes
  useEffect(() => {
    if (slot) {
      // Editing existing slot
      form.setValues({
        subjectId: slot.subjectId || '',
        staffId: slot.staffId || '',
        room: slot.room || '',
        periodNumber: slot.periodNumber ? String(slot.periodNumber) : '',
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
      });
    } else if (timeRange) {
      // Creating new slot with pre-filled time range
      const [startTime, endTime] = timeRange.split('-');
      form.setValues({
        subjectId: '',
        staffId: '',
        room: '',
        periodNumber: '',
        startTime: startTime || '',
        endTime: endTime || '',
        slotType: 'class',
      });
    } else {
      // Creating new slot without time range
      form.reset();
      form.setFieldValue('slotType', 'class');
    }
    setConflictWarning(null);
  }, [slot, timeRange, opened]);

  // Real-time conflict checking
  useEffect(() => {
    if (!opened || !onConflictCheck) return;
    
    const checkConflict = async () => {
      if (!form.values.startTime || !form.values.endTime || !form.values.slotType) return;
      
      setIsCheckingConflict(true);
      try {
        const slotInput: Partial<CreateTimetableSlotInput> = {
          classSectionId,
          dayOfWeek,
          startTime: form.values.startTime,
          endTime: form.values.endTime,
          subjectId: form.values.subjectId || undefined,
          staffId: form.values.staffId || undefined,
          slotType: form.values.slotType,
        };
        
        const hasConflict = await onConflictCheck(slotInput);
        if (hasConflict) {
          setConflictWarning('This slot may conflict with existing timetable entries. Please review.');
        } else {
          setConflictWarning(null);
        }
      } catch (error) {
        // Silently fail conflict check - don't block user
        setConflictWarning(null);
      } finally {
        setIsCheckingConflict(false);
      }
    };

    const timeoutId = setTimeout(checkConflict, 500); // Debounce 500ms
    return () => clearTimeout(timeoutId);
  }, [form.values.startTime, form.values.endTime, form.values.staffId, form.values.slotType, opened]);

  const handleSubmit = async (values: typeof form.values) => {
    const daysToCreate = isEdit
      ? [dayOfWeek] // When editing, only update the current day
      : [dayOfWeek, ...values.additionalDays.map((d) => Number(d))]; // When creating, include additional days

    // Create/update slot for each day
    const promises = daysToCreate.map((day) =>
      createOrUpdate.mutateAsync({
        ...(isEdit && slot ? { id: slot.id } : {}), // Include ID when editing
        classSectionId,
        dayOfWeek: day,
        periodNumber: values.periodNumber ? Number(values.periodNumber) : undefined,
        subjectId: values.subjectId || undefined,
        staffId: values.staffId || undefined,
        room: values.room || undefined,
        startTime: values.startTime,
        endTime: values.endTime,
        slotType: values.slotType,
        academicYearId,
        subjectTemplateId,
      }),
    );

    await Promise.all(promises);
    form.reset();
    setConflictWarning(null);
    onClose();
  };

  const handleDelete = async () => {
    if (!slot) return;
    await deleteSlot.mutateAsync(slot.id);
    onClose();
  };

  // Subject list: when a subject template is selected, show ONLY subjects in that template
  const templateSubjectIds =
    subjectTemplateId && subjectTemplate?.subjectIds?.length
      ? new Set(subjectTemplate.subjectIds)
      : null;

  const subjectOptions =
    templateSubjectIds !== null
      ? subjects
          .filter((s) => templateSubjectIds.has(s.id))
          .map((s) => ({ value: s.id, label: s.name }))
      : subjectTemplateId
        ? [] // Template selected but not loaded or has no subjects – show none
        : subjects.map((s) => ({ value: s.id, label: s.name }));

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

  if (!opened) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <Paper
        shadow="lg"
        p="md"
        withBorder
        style={{
          backgroundColor: 'var(--mantine-color-body)',
          width: 420,
          maxWidth: '90vw',
          position: 'relative',
          zIndex: 1001,
          overflow: 'visible',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>
                {isEdit ? 'Edit Slot' : 'Create Slot'}
              </Text>
              <Button
                variant="subtle"
                size="xs"
                p={4}
                onClick={onClose}
                style={{ minWidth: 'auto', height: 'auto' }}
              >
                <IconX size={16} />
              </Button>
            </Group>

            {conflictWarning && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Conflict Warning"
                color="orange"
                p="xs"
              >
                <Text size="xs">{conflictWarning}</Text>
              </Alert>
            )}

            <Select
              label="Slot Type"
              size="xs"
              data={[
                { value: 'class', label: 'Class' },
                { value: 'assembly', label: 'Assembly' },
                { value: 'break', label: 'Break' },
              ]}
              required
              comboboxProps={{ zIndex: 1002 }}
              {...form.getInputProps('slotType')}
            />

            {form.values.slotType === 'class' && (
              <>
                <Select
                  label="Subject"
                  size="xs"
                  placeholder={subjectOptions.length === 0 ? 'No subjects assigned to this class' : 'Select subject'}
                  data={subjectOptions}
                  required
                  allowDeselect={false}
                  disabled={subjectOptions.length === 0}
                  comboboxProps={{ zIndex: 1002 }}
                  checkIconPosition="right"
                  {...form.getInputProps('subjectId')}
                />
                {form.values.subjectId && (
                  <>
                    {staffOptions.length === 0 ? (
                      <>
                        <Select
                          label="Teacher"
                          size="xs"
                          placeholder="No teacher assigned to this subject"
                          data={[]}
                          disabled
                          comboboxProps={{ zIndex: 1002 }}
                          {...form.getInputProps('staffId')}
                        />
                        <Text size="xs" c="dimmed">
                          Assign a teacher to this subject in Academic → Teacher Mapping first.
                        </Text>
                      </>
                    ) : staffOptions.length === 1 ? (
                      <TextInput
                        label="Teacher"
                        size="xs"
                        value={staffOptions[0].label}
                        readOnly
                        styles={{ input: { backgroundColor: 'var(--mantine-color-default-hover)' } }}
                      />
                    ) : (
                      <Select
                        label="Teacher"
                        size="xs"
                        placeholder="Select teacher"
                        data={staffOptions}
                        searchable
                        comboboxProps={{ zIndex: 1002 }}
                        {...form.getInputProps('staffId')}
                      />
                    )}
                  </>
                )}
              </>
            )}

            <TextInput
              label="Room"
              size="xs"
              placeholder="Optional"
              {...form.getInputProps('room')}
            />

            <TextInput
              label="Period number"
              size="xs"
              placeholder="Optional (e.g. 1, 2, 3)"
              {...form.getInputProps('periodNumber')}
            />

            <Group gap="xs">
              <TextInput
                label="Start Time"
                type="time"
                size="xs"
                required
                style={{ flex: 1 }}
                {...form.getInputProps('startTime')}
              />
              <TextInput
                label="End Time"
                type="time"
                size="xs"
                required
                style={{ flex: 1 }}
                {...form.getInputProps('endTime')}
              />
            </Group>

            {!isEdit && dayOptions.length > 0 && (
              <MultiSelect
                label="Also assign to other days"
                placeholder="Select additional days (optional)"
                size="xs"
                data={dayOptions}
                comboboxProps={{ zIndex: 1002 }}
                {...form.getInputProps('additionalDays')}
              />
            )}

            <Group justify="flex-end" gap="xs" mt="xs">
              {isEdit && (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={handleDelete}
                  loading={deleteSlot.isPending}
                >
                  Delete
                </Button>
              )}
              <Button
                variant="subtle"
                size="xs"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="xs"
                loading={createOrUpdate.isPending || isCheckingConflict}
              >
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </div>
  );
}

