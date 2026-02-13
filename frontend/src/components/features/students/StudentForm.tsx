'use client';

import { Modal, TextInput, Select, Button, Stack, Textarea, Group, Paper, Divider, Badge, Alert, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateStudent, useUpdateStudent, useGenerateStudentId } from '@/hooks/useStudents';
import { useClasses, useSections } from '@/hooks/useCoreLookups';
import { useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useTemplatesForClass, useStudentTemplate } from '@/hooks/useSubjectTemplates';
import { useAuth } from '@/hooks/useAuth';
import type { Student, CreateStudentInput, UpdateStudentInput } from '@/types/students';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStudentGuardians } from '@/hooks/useParentAssociations';
import { IconPhone, IconUser } from '@tabler/icons-react';

const createStudentSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  studentId: z.string().min(1, 'Student ID is required'),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  bloodGroup: z.string().optional(),
  medicalNotes: z.string().optional(),
  admissionDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateStudentSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  bloodGroup: z.string().optional(),
  medicalNotes: z.string().optional(),
  admissionDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

interface StudentFormProps {
  opened: boolean;
  onClose: () => void;
  student?: Student | null;
}

export function StudentForm({ opened, onClose, student }: StudentFormProps) {
  const isEdit = !!student;
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const queryClient = useQueryClient();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const generateId = useGenerateStudentId();

  const { data: classesData } = useClasses();
  const { data: sectionsData } = useSections();
  const { data: academicYearsData } = useAcademicYearsList({ page: 1, limit: 50 });
  const classes = classesData?.data ?? [];
  const sections = sectionsData?.data ?? [];
  const academicYears = academicYearsData?.data || [];

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      fullName: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      gender: undefined as 'male' | 'female' | undefined,
      studentId: '',
      classId: '',
      sectionId: '',
      bloodGroup: '',
      medicalNotes: '',
      admissionDate: '',
      academicYearId: '',
      isActive: true,
      subjectTemplateId: '',
    },
    validate: zodResolver(isEdit ? updateStudentSchema : createStudentSchema),
  });

  // Fetch available templates for selected class
  // Use student's classId if in edit mode and form hasn't been populated yet
  const effectiveClassId = form.values.classId || student?.classId || null;
  const { data: templatesData, isLoading: templatesLoading } = useTemplatesForClass(
    effectiveClassId,
    branchId ?? null,
  );
  
  // Fetch student's current template assignment (for edit mode)
  const { data: studentTemplateData } = useStudentTemplate(
    student?.id ?? null,
    form.values.academicYearId || student?.academicYearId || null,
    branchId ?? null,
  );

  const availableTemplates = templatesData?.data ?? [];
  const currentTemplate = studentTemplateData?.data;

  // Fetch guardians for this student (when editing)
  const { data: guardiansData } = useStudentGuardians(isEdit ? student?.id : null);
  const guardians = guardiansData?.data || [];

  // Reset form when student prop changes (for edit mode)
  useEffect(() => {
    if (student) {
      // Invalidate student template query when modal opens to ensure fresh data
      if (student.id && branchId) {
        const academicYearId = student.academicYearId || null;
        queryClient.invalidateQueries({
          queryKey: ['subject-templates', 'student', student.id, academicYearId, branchId],
        });
      }
      
      // Invalidate templates query when modal opens with a student to ensure fresh data
      if (student.classId && branchId) {
        queryClient.invalidateQueries({ queryKey: ['subject-templates', 'class', student.classId, branchId] });
      }

      form.setValues({
        email: student.email || '',
        password: '',
        fullName: student.fullName || '',
        phone: student.phone || '',
        address: student.address || '',
        dateOfBirth: student.dateOfBirth || '',
        gender: student.gender || undefined,
        studentId: student.studentId || '',
        classId: student.classId || '',
        sectionId: student.sectionId || '',
        bloodGroup: student.bloodGroup || '',
        medicalNotes: student.medicalNotes || '',
        admissionDate: student.admissionDate || '',
        academicYearId: student.academicYearId || '',
        isActive: student.isActive ?? true,
        subjectTemplateId: student.subjectTemplateId || currentTemplate?.id || '',
      });
    } else {
      form.reset();
    }
  }, [student, currentTemplate, branchId, queryClient]);

  // Generate student ID when class/section/year changes
  useEffect(() => {
    if (!isEdit && form.values.classId && form.values.sectionId) {
      generateId.mutate(
        {
          classId: form.values.classId,
          sectionId: form.values.sectionId,
          academicYearId: form.values.academicYearId || undefined,
        },
        {
          onSuccess: (data) => {
            // useGenerateStudentId returns { data: { studentId } }
            if (data?.data?.studentId) {
              form.setFieldValue('studentId', data.data.studentId);
            }
          },
        },
      );
    }
  }, [form.values.classId, form.values.sectionId, form.values.academicYearId, isEdit]);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      if (isEdit && student) {
        const updateData: UpdateStudentInput = {
          fullName: values.fullName,
          phone: values.phone || undefined,
          address: values.address || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          classId: values.classId || undefined,
          sectionId: values.sectionId || undefined,
          bloodGroup: values.bloodGroup || undefined,
          medicalNotes: values.medicalNotes || undefined,
          admissionDate: values.admissionDate || undefined,
          academicYearId: values.academicYearId || undefined,
          isActive: values.isActive,
          subjectTemplateId: values.subjectTemplateId || undefined,
        };

        await updateStudent.mutateAsync({ id: student.id, input: updateData });
      } else {
        const createData: CreateStudentInput = {
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          phone: values.phone || undefined,
          address: values.address || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          studentId: values.studentId,
          classId: values.classId || undefined,
          sectionId: values.sectionId || undefined,
          bloodGroup: values.bloodGroup || undefined,
          medicalNotes: values.medicalNotes || undefined,
          admissionDate: values.admissionDate || undefined,
          academicYearId: values.academicYearId || undefined,
          isActive: values.isActive,
          subjectTemplateId: values.subjectTemplateId || undefined,
        };

        await createStudent.mutateAsync(createData);
      }

      if (!isEdit) {
        form.reset();
      }
      onClose();
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? 'Edit Student' : 'Create Student'} size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <TextInput label="Email" placeholder="student@example.com" required {...form.getInputProps('email')} />
              <TextInput
                label="Password"
                type="password"
                placeholder="Minimum 6 characters"
                required
                {...form.getInputProps('password')}
              />
            </>
          )}

          <TextInput label="Full Name" placeholder="John Doe" required {...form.getInputProps('fullName')} />

          <TextInput label="Student ID" placeholder="Auto-generated" required {...form.getInputProps('studentId')} />

          <Select
            label="Academic Year"
            data={academicYears.map((y) => ({ value: y.id, label: y.name }))}
            {...form.getInputProps('academicYearId')}
          />

          <Group grow>
            <Select
              label="Class"
              data={classes.map((c) => ({ value: c.id, label: c.displayName }))}
              {...form.getInputProps('classId')}
            />
            <Select
              label="Section"
              data={sections.map((s) => ({ value: s.id, label: s.name }))}
              {...form.getInputProps('sectionId')}
            />
          </Group>

          <TextInput label="Phone" placeholder="+1234567890" {...form.getInputProps('phone')} />
          <TextInput label="Address" placeholder="123 Main St" {...form.getInputProps('address')} />
          <TextInput label="Date of Birth" type="date" {...form.getInputProps('dateOfBirth')} />

          <Select
            label="Gender"
            data={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            {...form.getInputProps('gender')}
          />

          <TextInput label="Blood Group" placeholder="O+" {...form.getInputProps('bloodGroup')} />
          <Textarea label="Medical Notes" placeholder="Any medical conditions..." {...form.getInputProps('medicalNotes')} />
          <TextInput label="Admission Date" type="date" {...form.getInputProps('admissionDate')} />

          <Select
            label="Subject Template (Optional)"
            placeholder={
              effectiveClassId
                ? availableTemplates.length === 0
                  ? 'No templates available for this class'
                  : 'Select subject template'
                : 'Select a class first'
            }
            data={availableTemplates.map((t) => ({ value: t.id, label: t.name }))}
            {...form.getInputProps('subjectTemplateId')}
            clearable
            disabled={!effectiveClassId || availableTemplates.length === 0}
            description={
              !effectiveClassId
                ? 'Select a class to see available templates'
                : availableTemplates.length === 0
                  ? 'No subject templates are assigned to this class. Assign templates in Settings > Subject Templates.'
                  : 'Templates available for this class/level. Only one template can be assigned per student.'
            }
          />

          <Select
            label="Status"
            data={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
          />

          {/* Emergency Contacts (only shown when editing) */}
          {isEdit && student && (
            <>
              <Divider my="md" />
              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <Group>
                    <IconUser size={20} />
                    <Text fw={500}>Emergency Contacts</Text>
                  </Group>
                  {guardians.length === 0 ? (
                    <Alert color="yellow" size="sm">
                      No guardians assigned. Add guardians from Parent Associations page.
                    </Alert>
                  ) : (
                    <Stack gap="xs">
                      {guardians.map((guardian) => (
                        <Group key={guardian.id} justify="space-between" p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: '4px' }}>
                          <Group gap="xs">
                            <Badge
                              size="sm"
                              color={guardian.priority === 1 ? 'green' : 'blue'}
                              variant="light"
                            >
                              {guardian.priority === 1 ? 'Primary' : 'Secondary'}
                            </Badge>
                            <Text size="sm" fw={500}>
                              {guardian.parentName || 'N/A'}
                            </Text>
                            <Text size="xs" c="dimmed">
                              ({guardian.relationship})
                            </Text>
                          </Group>
                          {guardian.parentPhone && (
                            <Group gap={4}>
                              <IconPhone size={14} />
                              <Text size="sm">{guardian.parentPhone}</Text>
                            </Group>
                          )}
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createStudent.isPending || updateStudent.isPending}>
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

