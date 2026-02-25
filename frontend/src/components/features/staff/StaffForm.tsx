'use client';

import { Modal, TextInput, Select, Button, Stack, MultiSelect, Group } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { z } from 'zod';
import { useCreateStaff, useUpdateStaff } from '@/hooks/useStaff';
import type { Staff, CreateStaffInput, UpdateStaffInput } from '@/types/staff';
import type { Role } from '@/types/permissions';

const createStaffSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  joinDate: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateStaffSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  joinDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

interface StaffFormProps {
  opened: boolean;
  onClose: () => void;
  staff?: Staff | null;
  roles: Role[];
}

export function StaffForm({ opened, onClose, staff, roles }: StaffFormProps) {
  const isEdit = !!staff;
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();

  const form = useForm({
    initialValues: {
      email: staff?.email || '',
      password: '',
      fullName: staff?.fullName || '',
      phone: '',
      address: '',
      dateOfBirth: '',
      gender: undefined as 'male' | 'female' | undefined,
      employeeId: staff?.employeeId || '',
      department: staff?.department || '',
      joinDate: staff?.joinDate || '',
      roleIds: staff?.roles?.map((r) => r.roleId) || [],
      isActive: staff?.isActive ?? true,
    },
    validate: zodResolver(isEdit ? updateStaffSchema : createStaffSchema),
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      if (isEdit && staff) {
        const updateData: UpdateStaffInput = {
          fullName: values.fullName,
          phone: values.phone || undefined,
          address: values.address || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          employeeId: values.employeeId || undefined,
          department: values.department || undefined,
          joinDate: values.joinDate || undefined,
          isActive: values.isActive,
        };

        await updateStaff.mutateAsync({ id: staff.id, input: updateData });
      } else {
        const createData: CreateStaffInput = {
          email: values.email,
          password: values.password,
          fullName: values.fullName,
          phone: values.phone || undefined,
          address: values.address || undefined,
          dateOfBirth: values.dateOfBirth || undefined,
          gender: values.gender,
          employeeId: values.employeeId || undefined,
          department: values.department || undefined,
          joinDate: values.joinDate || undefined,
          roleIds: values.roleIds,
          isActive: values.isActive,
        };

        await createStaff.mutateAsync(createData);
      }

      form.reset();
      onClose();
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={isEdit ? 'Edit Staff' : 'Create Staff'} size="lg">
      <form id="staff-form" onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {!isEdit && (
            <>
              <TextInput id="staff-form-email" label="Email" placeholder="staff@example.com" required {...form.getInputProps('email')} />
              <TextInput
                id="staff-form-password"
                label="Password"
                type="password"
                placeholder="Minimum 6 characters"
                required
                {...form.getInputProps('password')}
              />
            </>
          )}

          <TextInput id="staff-form-full-name" label="Full Name" placeholder="John Doe" required {...form.getInputProps('fullName')} />
          <TextInput id="staff-form-employee-id" label="Employee ID" placeholder="EMP001" {...form.getInputProps('employeeId')} />
          <TextInput id="staff-form-department" label="Department" placeholder="Academic" {...form.getInputProps('department')} />
          <TextInput id="staff-form-phone" label="Phone" placeholder="+1234567890" {...form.getInputProps('phone')} />
          <TextInput id="staff-form-address" label="Address" placeholder="123 Main St" {...form.getInputProps('address')} />
          <TextInput id="staff-form-date-of-birth" label="Date of Birth" type="date" {...form.getInputProps('dateOfBirth')} />
          <TextInput id="staff-form-join-date" label="Join Date" type="date" {...form.getInputProps('joinDate')} />

          <Select
            id="staff-form-gender"
            label="Gender"
            data={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            {...form.getInputProps('gender')}
          />

          <MultiSelect
            id="staff-form-roles"
            label="Roles"
            data={roles.map((r) => ({ value: r.id, label: r.displayName }))}
            {...form.getInputProps('roleIds')}
          />

          <Select
            id="staff-form-status"
            label="Status"
            data={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
          />

          <Group justify="flex-end" mt="md">
            <Button id="staff-form-cancel" variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button id="staff-form-submit" type="submit" loading={createStaff.isPending || updateStaff.isPending}>
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

