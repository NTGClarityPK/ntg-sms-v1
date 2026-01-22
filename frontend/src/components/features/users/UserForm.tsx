'use client';

import { Modal, TextInput, Select, Button, Stack, MultiSelect, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateUser, useUpdateUser, useUpdateUserRoles } from '@/hooks/useUsers';
import type { User, CreateUserInput, UpdateUserInput } from '@/types/users';
import type { Role } from '@/types/permissions';

const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  roleIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  isActive: z.boolean().optional(),
});

interface UserFormProps {
  opened: boolean;
  onClose: () => void;
  user?: User | null;
  roles: Role[];
}

export function UserForm({ opened, onClose, user, roles }: UserFormProps) {
  const isEdit = !!user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const updateUserRoles = useUpdateUserRoles();

  const form = useForm({
    initialValues: {
      email: user?.email || '',
      password: '',
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      address: user?.address || '',
      dateOfBirth: user?.dateOfBirth || '',
      gender: user?.gender || undefined,
      roleIds: user?.roles?.map((r) => r.roleId) || [],
      isActive: user?.isActive ?? true,
    },
    validate: zodResolver(isEdit ? updateUserSchema : createUserSchema),
  });

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

      form.reset();
      onClose();
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Edit User' : 'Create User'}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <TextInput
                label="Email"
                placeholder="user@example.com"
                required
                {...form.getInputProps('email')}
              />
              <TextInput
                label="Password"
                type="password"
                placeholder="Minimum 6 characters"
                required={!isEdit}
                {...form.getInputProps('password')}
              />
            </>
          )}

          <TextInput
            label="Full Name"
            placeholder="John Doe"
            required
            {...form.getInputProps('fullName')}
          />

          <TextInput
            label="Phone"
            placeholder="+1234567890"
            {...form.getInputProps('phone')}
          />

          <TextInput
            label="Address"
            placeholder="123 Main St"
            {...form.getInputProps('address')}
          />

          <TextInput
            label="Date of Birth"
            type="date"
            {...form.getInputProps('dateOfBirth')}
          />

          <Select
            label="Gender"
            data={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            {...form.getInputProps('gender')}
          />

          <MultiSelect
            label="Roles"
            data={roles.map((r) => ({ value: r.id, label: r.displayName }))}
            {...form.getInputProps('roleIds')}
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

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createUser.isPending || updateUser.isPending || updateUserRoles.isPending}
            >
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

