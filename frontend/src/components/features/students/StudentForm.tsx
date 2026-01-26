'use client';

import { Modal, TextInput, Select, Button, Stack, Textarea, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateStudent, useUpdateStudent, useGenerateStudentId } from '@/hooks/useStudents';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useAcademicYearsList } from '@/hooks/useAcademicYears';
import type { Student, CreateStudentInput, UpdateStudentInput } from '@/types/students';
import { useEffect } from 'react';

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
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const generateId = useGenerateStudentId();

  const { data: classesData } = useCoreLookups('classes');
  const { data: sectionsData } = useCoreLookups('sections');
  const { data: academicYearsData } = useAcademicYearsList({ page: 1, limit: 50 });
  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];
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
    },
    validate: zodResolver(isEdit ? updateStudentSchema : createStudentSchema),
  });

  // Reset form when student prop changes (for edit mode)
  useEffect(() => {
    if (student) {
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
      });
    } else {
      form.reset();
    }
  }, [student]);

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
            form.setFieldValue('studentId', data.data.studentId);
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
          isActive: values.isActive,
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
            label="Status"
            data={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
          />

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

