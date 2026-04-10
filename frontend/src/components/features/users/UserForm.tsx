'use client';

import { useEffect, useMemo } from 'react';
import { Modal, TextInput, Select, Button, Stack, MultiSelect, Group, Text, Alert, CopyButton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useCreateUser, useUpdateUser, useUpdateUserRoles } from '@/hooks/useUsers';
import type { User, CreateUserInput, UpdateUserInput } from '@/types/users';
import type { Role } from '@/types/permissions';
import { useTenantMe } from '@/hooks/useTenant';

interface UserFormProps {
  opened: boolean;
  onClose: () => void;
  user?: User | null;
  roles: Role[];
}

export function UserForm({ opened, onClose, user, roles }: UserFormProps) {
  const t = useTranslations('user');
  const tCommon = useTranslations('common');
  const tenantMe = useTenantMe();
  const tenantDomain = tenantMe.data?.data?.domain?.trim() || '';

  const parentRoleNames = useMemo(() => new Set(['parent', 'guardian', 'father', 'mother']), []);
  const roleNameById = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);
  const classifyUserType = (roleIds: string[]) => {
    const names = roleIds.map((id) => (roleNameById.get(id) || '').trim().toLowerCase()).filter(Boolean);
    const isParent = names.some((n) => parentRoleNames.has(n));
    const isStaff = names.some((n) => !parentRoleNames.has(n));
    if (isParent && isStaff) return 'mixed' as const;
    if (isParent) return 'parent' as const;
    return 'staff' as const;
  };

  const createUserSchema = useMemo(
    () =>
      z
        .object({
          roleIds: z.array(z.string()).min(1, t('roleRequired')),
          email: z.string().optional(),
          username: z.string().optional(),
          invitationEmail: z.string().optional(),
          fullName: z.string().min(1, t('fullNameRequired')),
          phone: z.string().optional(),
          address: z.string().optional(),
          dateOfBirth: z.string().optional(),
          gender: z.enum(['male', 'female']).optional(),
          isActive: z.boolean().optional(),
        })
        .superRefine((values, ctx) => {
          const userType = classifyUserType(values.roleIds);
          if (userType === 'mixed') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['roleIds'],
              message: 'Parent roles cannot be combined with staff roles.',
            });
            return;
          }

          if (userType === 'parent') {
            const raw = (values.email ?? '').trim();
            const isEmail = raw.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
            if (!isEmail) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['email'],
                message: t('invalidEmail'),
              });
            }
            return;
          }

          // staff
          const username = (values.username ?? '').trim();
          if (!username || !/^[a-z0-9]+$/i.test(username)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['username'],
              message: 'Username must be alphanumeric.',
            });
          }
          const inv = (values.invitationEmail ?? '').trim();
          const isEmail = inv.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inv);
          if (!isEmail) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['invitationEmail'],
              message: t('invalidEmail'),
            });
          }
        }),
    [t, classifyUserType],
  );
  const updateUserSchema = useMemo(
    () =>
      z.object({
        fullName: z.string().min(1, t('fullNameRequired')),
        phone: z.string().optional(),
        address: z.string().optional(),
        dateOfBirth: z.string().optional(),
        gender: z.enum(['male', 'female']).optional(),
        isActive: z.boolean().optional(),
      }),
    [t],
  );
  const isEdit = !!user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const updateUserRoles = useUpdateUserRoles();

  const form = useForm({
    initialValues: {
      email: '',
      username: '',
      invitationEmail: '',
      fullName: '',
      phone: '',
      address: '',
      dateOfBirth: '',
      gender: undefined as 'male' | 'female' | undefined,
      roleIds: [] as string[],
      isActive: true,
    },
    validate: zodResolver(isEdit ? updateUserSchema : createUserSchema),
  });

  // Reset form when user prop changes (for edit mode)
  useEffect(() => {
    if (user) {
      form.setValues({
        email: user.email || '',
        username: '',
        invitationEmail: '',
        fullName: user.fullName || '',
        phone: user.phone || '',
        address: user.address || '',
        dateOfBirth: user.dateOfBirth || '',
        gender: user.gender || undefined,
        roleIds: user.roles?.map((r) => r.roleId) || [],
        isActive: user.isActive ?? true,
      });
    } else {
      form.reset();
    }
  }, [user]);

  const handleSubmit = async (values: typeof form.values) => {
    try {
      if (isEdit && user) {
        const updateData: UpdateUserInput = {
          fullName: values.fullName,
          phone: values.phone || undefined,
          address: values.address || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          isActive: values.isActive,
        };

        await updateUser.mutateAsync({ id: user.id, input: updateData });

        // Update roles separately
        if (values.roleIds) {
          await updateUserRoles.mutateAsync({
            id: user.id,
            input: { roleIds: values.roleIds },
          });
        }
      } else {
        const userType = classifyUserType(values.roleIds);
        const createData: CreateUserInput = {
          email: userType === 'parent' ? values.email : undefined,
          username: userType === 'staff' ? values.username : undefined,
          invitationEmail: userType === 'staff' ? values.invitationEmail : undefined,
          fullName: values.fullName,
          phone: values.phone || undefined,
          address: values.address || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          roleIds: values.roleIds,
          isActive: values.isActive,
        };

        await createUser.mutateAsync(createData);
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
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? t('editUser') : t('createUser')}
      size="lg"
    >
      <form id="user-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {isEdit && user?.invitationRecipientEmail && (
            <Alert
              variant="light"
              title={t('invitationDetailsTitle')}
              styles={{
                root: {
                  borderColor: 'var(--theme-primary)',
                  backgroundColor: 'var(--theme-surface-variant)',
                },
                title: { color: 'var(--theme-text)' },
              }}
            >
              <Stack gap={6}>
                <Group justify="space-between" align="flex-end" wrap="nowrap">
                  <TextInput
                    id="user-form-invitation-recipient-email"
                    label={t('invitationRecipientEmail')}
                    value={user.invitationRecipientEmail}
                    readOnly
                    style={{ flex: 1 }}
                  />
                  <CopyButton value={user.invitationRecipientEmail}>
                    {({ copy }) => (
                      <Button
                        id="user-form-invitation-copy-email"
                        size="xs"
                        variant="light"
                        onClick={copy}
                      >
                        {tCommon('copy')}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
                {user.invitationSentAt && (
                  <Text size="sm" c="dimmed">
                    {t('invitationSentAt', {
                      date: new Date(user.invitationSentAt).toLocaleString(),
                    })}
                  </Text>
                )}
              </Stack>
            </Alert>
          )}
          {!isEdit && (
            <>
              <MultiSelect
                id="user-form-roles-top"
                label={t('roles')}
                data={roles.map((r) => ({ value: r.id, label: tCommon(`roleName.${r.name}` as any) || r.displayName }))}
                required
                {...form.getInputProps('roleIds')}
              />

              {classifyUserType(form.values.roleIds) === 'mixed' && (
                <Alert id="user-form-role-mixed-alert" color="red" variant="light">
                  Parent roles cannot be combined with staff roles.
                </Alert>
              )}

              {classifyUserType(form.values.roleIds) === 'parent' && (
                <TextInput
                  id="user-form-parent-email"
                  label={t('email')}
                  placeholder={t('emailPlaceholder')}
                  required
                  {...form.getInputProps('email')}
                />
              )}

              {classifyUserType(form.values.roleIds) === 'staff' && (
                <>
                  <Group grow align="flex-end">
                    <TextInput
                      id="user-form-username"
                      label="Username"
                      placeholder="john.smith"
                      required
                      {...form.getInputProps('username')}
                    />
                    <TextInput
                      id="user-form-domain"
                      label="Domain"
                      value={tenantDomain ? `@${tenantDomain}` : '—'}
                      readOnly
                      styles={{ input: { backgroundColor: 'var(--mantine-color-default-hover)' } }}
                    />
                  </Group>
                  <Text size="xs" c="dimmed">
                    Login email will be: <strong>{`${(form.values.username || 'username').trim()}@${tenantDomain || 'domain'}`}</strong>
                  </Text>
                  <TextInput
                    id="user-form-invitation-email"
                    label="Invitation email"
                    placeholder="name@example.com"
                    required
                    {...form.getInputProps('invitationEmail')}
                  />
                </>
              )}
            </>
          )}

          <TextInput
            id="user-form-full-name"
            label={t('fullName')}
            placeholder={t('fullNamePlaceholder')}
            required
            {...form.getInputProps('fullName')}
          />

          <TextInput
            id="user-form-phone"
            label={t('phone')}
            placeholder={t('phonePlaceholder')}
            {...form.getInputProps('phone')}
          />

          <TextInput
            id="user-form-address"
            label={t('address')}
            placeholder={t('addressPlaceholder')}
            {...form.getInputProps('address')}
          />

          <TextInput
            id="user-form-date-of-birth"
            label={t('dateOfBirth')}
            type="date"
            {...form.getInputProps('dateOfBirth')}
          />

          <Select
            id="user-form-gender"
            label={t('gender')}
            data={[
              { value: 'male', label: t('male') },
              { value: 'female', label: t('female') },
            ]}
            {...form.getInputProps('gender')}
          />

          {isEdit && (
            <MultiSelect
              id="user-form-roles"
              label={t('roles')}
              data={roles.map((r) => ({ value: r.id, label: tCommon(`roleName.${r.name}` as any) || r.displayName }))}
              required
              {...form.getInputProps('roleIds')}
            />
          )}

          <Select
            id="user-form-status"
            label={t('status')}
            data={[
              { value: 'true', label: t('active') },
              { value: 'false', label: t('inactive') },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
          />

          <Group justify="flex-end" mt="md">
            <Button id="user-form-cancel" variant="subtle" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              id="user-form-submit"
              type="submit"
              loading={createUser.isPending || updateUser.isPending || updateUserRoles.isPending}
            >
              {isEdit ? t('update') : t('create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

