'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal, TextInput, Select, Button, Stack, Textarea, Group, Paper, Divider, Badge, Alert, Text, Radio, Checkbox, CopyButton, Table } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateStudentWithInvitation, useUpdateStudent } from '@/hooks/useStudents';
import { useClasses, useSections } from '@/hooks/useCoreLookups';
import { useTemplatesForClass, useStudentTemplate } from '@/hooks/useSubjectTemplates';
import { useAuth } from '@/hooks/useAuth';
import type { Student, CreateStudentWithInvitationInput, UpdateStudentInput } from '@/types/students';
import { useQueryClient } from '@tanstack/react-query';
import { useStudentGuardians } from '@/hooks/useParentAssociations';
import { IconPhone, IconUser } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTenantMe } from '@/hooks/useTenant';
import { modals } from '@mantine/modals';

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
  const createStudent = useCreateStudentWithInvitation();
  const updateStudent = useUpdateStudent();
  const tenantMe = useTenantMe();
  const tenantDomain = tenantMe.data?.data?.domain?.trim() || '';

  const createStudentSchema = z.object({
    username: z
      .string()
      .trim()
      .min(1, t('usernameRequired'))
      .regex(/^[a-z0-9]+$/i, t('usernameInvalid')),
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
    invitationType: z.enum(['parent', 'student']),
    // Parent invite: must be a real email address.
    // Student invite: allow blank/username; we'll auto-build `${username}@${tenantDomain}` on submit.
    invitationRecipientEmail: z.string().optional(),
    createParentAccount: z.boolean().optional(),
    // Allow empty string when parent account creation is not enabled
    parentEmail: z.union([z.string().email(t('invalidEmail')), z.literal('')]).optional(),
    parentName: z.string().optional(),
    parentPhone: z.string().optional(),
    parentRelationship: z.enum(['father', 'mother', 'guardian']).optional(),
  }).superRefine((values, ctx) => {
    const raw = (values.invitationRecipientEmail ?? '').trim();
    const isEmail = raw.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);

    if (values.invitationType === 'parent') {
      if (!isEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['invitationRecipientEmail'],
          message: t('invalidEmail'),
        });
      }
      return;
    }

    // invitationType === 'student'
    // If user entered something containing '@', it must be a valid email.
    if (raw.includes('@') && !isEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['invitationRecipientEmail'],
        message: t('invalidEmail'),
      });
    }

    if (values.createParentAccount) {
      const parentEmailRaw = (values.parentEmail ?? '').trim();
      const parentIsEmail =
        parentEmailRaw.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmailRaw);
      if (!parentIsEmail) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['parentEmail'],
          message: t('invalidEmail'),
        });
      }
    }
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
  const classes = classesData?.data ?? [];
  const sections = sectionsData?.data ?? [];

  const form = useForm({
    initialValues: {
      username: '',
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
      isActive: true,
      subjectTemplateId: '',
      invitationType: 'parent' as 'parent' | 'student',
      invitationRecipientEmail: '',
      createParentAccount: false,
      parentEmail: '',
      parentName: '',
      parentPhone: '',
      parentRelationship: 'guardian' as 'father' | 'mother' | 'guardian',
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
    student?.academicYearId || null,
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
        username: '',
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
          isActive: values.isActive,
          subjectTemplateId: values.subjectTemplateId || undefined,
        };

        await updateStudent.mutateAsync({ id: student.id, input: updateData });
      } else {
        const recipientEmail = (() => {
          const raw = (values.invitationRecipientEmail ?? '').trim();
          if (values.invitationType === 'parent') return raw;
          // Student invite: if blank or username-like, send to login email.
          if (!raw) return `${values.username.trim()}@${tenantDomain}`;
          if (!raw.includes('@')) return `${raw}@${tenantDomain}`;
          return raw;
        })();

        const createData: CreateStudentWithInvitationInput = {
          username: values.username,
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
          isActive: values.isActive,
          subjectTemplateId: values.subjectTemplateId || undefined,
          invitationType: values.invitationType,
          invitationRecipientEmail: recipientEmail,
          createParentAccount: values.createParentAccount || undefined,
          parentEmail: values.createParentAccount ? values.parentEmail?.trim() || undefined : undefined,
          parentName: values.createParentAccount ? values.parentName || undefined : undefined,
          parentPhone: values.createParentAccount ? values.parentPhone || undefined : undefined,
          parentRelationship: values.createParentAccount ? values.parentRelationship : undefined,
        };

        const created = await createStudent.mutateAsync(createData);
        // Close creation modal, then show a separate summary modal.
        if (!isEdit) form.reset();
        onClose();

        modals.open({
          title: 'Invitation sent',
          size: 'lg',
          centered: true,
          children: (
            <Stack gap="sm">
              <Table withTableBorder withColumnBorders>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Th w={180}>Recipient email</Table.Th>
                    <Table.Td>
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm">{created.studentInvitation.recipientEmail}</Text>
                        <CopyButton value={created.studentInvitation.recipientEmail}>
                          {({ copy }) => (
                            <Button
                              id="invitation-sent-copy-recipient-email"
                              size="xs"
                              variant="light"
                              onClick={copy}
                            >
                              Copy
                            </Button>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Invitation type</Table.Th>
                    <Table.Td>
                      <Text size="sm">{created.studentInvitation.invitationType}</Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Expires at</Table.Th>
                    <Table.Td>
                      <Text size="sm">
                        {new Date(created.studentInvitation.expiresAt).toLocaleString()}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>

              {created.parentInvitation && (
                <Alert color="blue" title="Parent account invitation">
                  <Stack gap={6}>
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm">
                        <strong>Recipient email:</strong> {created.parentInvitation.recipientEmail}
                      </Text>
                      <CopyButton value={created.parentInvitation.recipientEmail}>
                        {({ copy }) => (
                          <Button
                            id="invitation-sent-copy-parent-recipient-email"
                            size="xs"
                            variant="light"
                            onClick={copy}
                          >
                            Copy
                          </Button>
                        )}
                      </CopyButton>
                    </Group>
                    <Text size="sm">
                      <strong>Expires at:</strong>{' '}
                      {new Date(created.parentInvitation.expiresAt).toLocaleString()}
                    </Text>
                  </Stack>
                </Alert>
              )}
            </Stack>
          ),
        });
      }

      if (!isEdit && !opened) {
        // no-op
      }
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? t('editStudent') : t('createStudent')} size="lg">
      <form
        id="student-form"
        onSubmit={form.onSubmit(handleSubmit, (errors) => {
          const firstKey = Object.keys(errors)[0];
          const firstMessage =
            firstKey && typeof (errors as Record<string, unknown>)[firstKey] === 'string'
              ? ((errors as Record<string, string>)[firstKey] as string)
              : null;

          notifications.show({
            title: 'Missing information',
            message:
              firstMessage ??
              'Please fix the highlighted fields and try again.',
            color: 'red',
          });
        })}
      >
        <Stack gap="md">
          {!isEdit && (
            <>
              <Group grow align="flex-end">
                <TextInput
                  id="student-form-username"
                  label={t('username')}
                  placeholder={t('usernamePlaceholder')}
                  required
                  {...form.getInputProps('username')}
                />
                <TextInput
                  id="student-form-domain"
                  label={t('domain')}
                  value={tenantDomain ? `@${tenantDomain}` : '—'}
                  readOnly
                  styles={{ input: { backgroundColor: 'var(--mantine-color-default-hover)' } }}
                />
              </Group>
              <Text size="xs" c="dimmed">
                Login email will be: <strong>{`${(form.values.username || 'username').trim()}@${tenantDomain || 'domain'}`}</strong>
              </Text>
              <Radio.Group
                id="student-form-invite-type"
                label="Send invitation to"
                value={form.values.invitationType}
                onChange={(value) => form.setFieldValue('invitationType', value as 'parent' | 'student')}
              >
                <Group mt="xs">
                  <Radio value="parent" label="Parent/Guardian" />
                  <Radio value="student" label="Student" />
                </Group>
              </Radio.Group>

              <TextInput
                id="student-form-invite-recipient-email"
                label="Invitation recipient email"
                placeholder="name@example.com"
                required
                {...form.getInputProps('invitationRecipientEmail')}
              />

              {form.values.invitationType === 'parent' && (
                <Checkbox
                  id="student-form-create-parent"
                  label="Parent account doesn’t exist — create parent account"
                  checked={form.values.createParentAccount}
                  onChange={(e) => form.setFieldValue('createParentAccount', e.currentTarget.checked)}
                />
              )}

              {form.values.invitationType === 'parent' && form.values.createParentAccount && (
                <Paper withBorder p="md" radius="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm">Parent account details</Text>
                    <TextInput
                      id="student-form-parent-email"
                      label="Parent login email"
                      placeholder="parent@gmail.com"
                      required
                      {...form.getInputProps('parentEmail')}
                    />
                    <TextInput
                      id="student-form-parent-name"
                      label="Parent name"
                      placeholder="Parent name"
                      required
                      {...form.getInputProps('parentName')}
                    />
                    <TextInput
                      id="student-form-parent-phone"
                      label="Parent phone"
                      placeholder="+123..."
                      {...form.getInputProps('parentPhone')}
                    />
                    <Select
                      id="student-form-parent-relationship"
                      label="Relationship"
                      data={[
                        { value: 'father', label: 'Father' },
                        { value: 'mother', label: 'Mother' },
                        { value: 'guardian', label: 'Guardian' },
                      ]}
                      {...form.getInputProps('parentRelationship')}
                    />
                  </Stack>
                </Paper>
              )}
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

