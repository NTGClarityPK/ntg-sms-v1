'use client';

import { useEffect, useMemo } from 'react';
import { Modal, TextInput, Select, Button, Stack, MultiSelect, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useCreateUser, useUpdateUser, useUpdateUserRoles } from '@/hooks/useUsers';
import type { User, CreateUserInput, UpdateUserInput } from '@/types/users';
import type { Role } from '@/types/permissions';

interface UserFormProps {
  opened: boolean;
  onClose: () => void;
  user?: User | null;
  roles: Role[];
}

export function UserForm({ opened, onClose, user, roles }: UserFormProps) {
  const t = useTranslations('user');
  const tCommon = useTranslations('common');
  const createUserSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('invalidEmail')),
        password: z.string().min(6, t('passwordMinLength')),
        fullName: z.string().min(1, t('fullNameRequired')),
        phone: z.string().optional(),
        address: z.string().optional(),
        dateOfBirth: z.string().optional(),
        gender: z.enum(['male', 'female']).optional(),
        roleIds: z.array(z.string()).min(1, t('roleRequired')),
        isActive: z.boolean().optional(),
      }),
    [t],
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
      password: '',
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
        password: '',
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
        const createData: CreateUserInput = {
          email: values.email,
          password: values.password,
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
          {!isEdit && (
            <>
              <TextInput
                id="user-form-email"
                label={t('email')}
                placeholder={t('emailPlaceholder')}
                required
                {...form.getInputProps('email')}
              />
              <TextInput
                id="user-form-password"
                label={t('password')}
                type="password"
                placeholder={t('passwordPlaceholder')}
                required={!isEdit}
                {...form.getInputProps('password')}
              />
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

          <MultiSelect
            id="user-form-roles"
            label={t('roles')}
            data={roles.map((r) => ({ value: r.id, label: tCommon(`roleName.${r.name}` as any) || r.displayName }))}
            required
            {...form.getInputProps('roleIds')}
          />

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

