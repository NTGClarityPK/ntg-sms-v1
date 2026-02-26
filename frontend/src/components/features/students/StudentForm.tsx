'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, TextInput, Select, Button, Stack, Textarea, Group, Paper, Divider, Badge, Alert, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateStudent, useUpdateStudent } from '@/hooks/useStudents';
import { useClasses, useSections } from '@/hooks/useCoreLookups';
import { useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useTemplatesForClass, useStudentTemplate } from '@/hooks/useSubjectTemplates';
import { useAuth } from '@/hooks/useAuth';
import type { Student, CreateStudentInput, UpdateStudentInput } from '@/types/students';
import { useQueryClient } from '@tanstack/react-query';
import { useStudentGuardians } from '@/hooks/useParentAssociations';
import { IconPhone, IconUser } from '@tabler/icons-react';

interface StudentFormProps {
  opened: boolean;
  onClose: () => void;
  student?: Student | null;
}

export function StudentForm({ opened, onClose, student }: StudentFormProps) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const isEdit = !!student;
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const queryClient = useQueryClient();
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();

  const createStudentSchema = z.object({
    email: z.string().email(t('invalidEmail')),
    password: z.string().min(6, t('passwordMinLength')),
    firstName: z.string().min(1, t('firstNameRequired')),
    lastName: z.string().min(1, t('secondNameRequired')),
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

  const updateStudentSchema = z.object({
    firstName: z.string().min(1, t('firstNameRequired')),
    lastName: z.string().min(1, t('secondNameRequired')),
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
      firstName: '',
      lastName: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      gender: undefined as 'male' | 'female' | undefined,
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
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        phone: student.phone || '',
        address: student.address || '',
        dateOfBirth: student.dateOfBirth || '',
        gender: student.gender || undefined,
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
  const handleSubmit = async (values: typeof form.values) => {
    try {
      if (isEdit && student) {
        const updateData: UpdateStudentInput = {
          firstName: values.firstName,
          lastName: values.lastName,
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
          firstName: values.firstName,
          lastName: values.lastName,
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
    <Modal opened={opened} onClose={onClose} title={isEdit ? t('editStudent') : t('createStudent')} size="lg">
      <form id="student-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <TextInput id="student-form-email" label={t('email')} placeholder={t('emailPlaceholder')} required {...form.getInputProps('email')} />
              <TextInput
                id="student-form-password"
                label={t('password')}
                type="password"
                placeholder={t('passwordPlaceholder')}
                required
                {...form.getInputProps('password')}
              />
            </>
          )}

          <TextInput id="student-form-first-name" label={t('firstName')} placeholder={t('firstNamePlaceholder')} required {...form.getInputProps('firstName')} />
          <TextInput id="student-form-last-name" label={t('secondName')} placeholder={t('lastNamePlaceholder')} required {...form.getInputProps('lastName')} />

          {isEdit && (
            <TextInput
              id="student-form-student-id"
              label={t('studentId')}
              value={student?.studentId || ''}
              readOnly
              styles={{ input: { backgroundColor: 'var(--mantine-color-default-hover)' } }}
            />
          )}

          <Select
            id="student-form-academic-year"
            label={t('academicYear')}
            data={academicYears.map((y) => ({ value: y.id, label: y.name }))}
            {...form.getInputProps('academicYearId')}
          />

          <Group grow>
            <Select
              id="student-form-class"
              label={t('class')}
              data={classes.map((c) => ({ value: c.id, label: c.displayName }))}
              {...form.getInputProps('classId')}
            />
            <Select
              id="student-form-section"
              label={t('section')}
              data={sections.map((s) => ({ value: s.id, label: s.name }))}
              {...form.getInputProps('sectionId')}
            />
          </Group>

          <TextInput id="student-form-phone" label={t('phone')} placeholder={t('phonePlaceholder')} {...form.getInputProps('phone')} />
          <TextInput id="student-form-address" label={t('address')} placeholder={t('addressPlaceholder')} {...form.getInputProps('address')} />
          <TextInput id="student-form-date-of-birth" label={t('dateOfBirth')} type="date" {...form.getInputProps('dateOfBirth')} />

          <Select
            id="student-form-gender"
            label={t('gender')}
            data={[
              { value: 'male', label: t('male') },
              { value: 'female', label: t('female') },
            ]}
            {...form.getInputProps('gender')}
          />

          <TextInput id="student-form-blood-group" label={t('bloodGroup')} placeholder={t('bloodGroupPlaceholder')} {...form.getInputProps('bloodGroup')} />
          <Textarea id="student-form-medical-notes" label={t('medicalNotes')} placeholder={t('medicalNotesPlaceholder')} {...form.getInputProps('medicalNotes')} />
          <TextInput id="student-form-admission-date" label={t('admissionDate')} type="date" {...form.getInputProps('admissionDate')} />

          <Select
            id="student-form-subject-template"
            label={t('subjectTemplateOptional')}
            placeholder={
              effectiveClassId
                ? availableTemplates.length === 0
                  ? t('noTemplatesForClass')
                  : t('selectSubjectTemplate')
                : t('selectClassFirst')
            }
            data={availableTemplates.map((tmpl) => ({ value: tmpl.id, label: tmpl.name }))}
            {...form.getInputProps('subjectTemplateId')}
            clearable
            disabled={!effectiveClassId || availableTemplates.length === 0}
            description={
              !effectiveClassId
                ? t('selectClassToSeeTemplates')
                : availableTemplates.length === 0
                  ? t('noTemplatesAssignedToClass')
                  : t('templatesDescription')
            }
          />

          <Select
            id="student-form-status"
            label={t('status')}
            data={[
              { value: 'true', label: t('active') },
              { value: 'false', label: t('inactive') },
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
                    <Text fw={500}>{t('emergencyContacts')}</Text>
                  </Group>
                  {guardians.length === 0 ? (
                    <Alert color="yellow">
                      <Text size="sm">{t('noGuardiansAssigned')}</Text>
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
                              {guardian.priority === 1 ? t('primary') : t('secondary')}
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
            <Button id="student-form-cancel" variant="subtle" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button id="student-form-submit" type="submit" loading={createStudent.isPending || updateStudent.isPending}>
              {isEdit ? t('update') : t('create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

