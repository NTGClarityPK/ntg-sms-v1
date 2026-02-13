'use client';

import { useState } from 'react';
import {
  Button,
  Group,
  Stack,
  Text,
  Title,
  Paper,
  TextInput,
  Grid,
  Select,
  NumberInput,
  Switch,
  Alert,
  Skeleton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAllTenants } from '@/hooks/useTenant';
import { useAssignBranchToTenant } from '@/hooks/useBranches';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useAuth } from '@/hooks/useAuth';

export default function AssignBranchPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const { user } = useAuth();
  const tenantsQuery = useAllTenants();
  const assignBranch = useAssignBranchToTenant();

  const form = useForm({
    initialValues: {
      tenantId: '',
      name: '',
      nameAr: '',
      code: '',
      address: '',
      phone: '',
      email: '',
      storageQuotaGb: 100,
      isActive: true,
    },
    validate: {
      tenantId: (value) => (!value ? 'Tenant is required' : null),
      name: (value) => (!value.trim() ? 'Branch name is required' : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await assignBranch.mutateAsync({
        tenantId: values.tenantId,
        name: values.name.trim(),
        nameAr: values.nameAr.trim() || undefined,
        code: values.code.trim() || undefined,
        address: values.address.trim() || undefined,
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
        storageQuotaGb: values.storageQuotaGb,
        isActive: values.isActive,
      });

      notifications.show({
        title: 'Success',
        message: 'Branch assigned to tenant successfully. All school_admin users for this tenant have been granted access to the new branch.',
        color: notifyColors.success,
      });

      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({
        title: 'Error',
        message,
        color: notifyColors.error,
      });
    }
  };

  // Check if user is super admin/dev/owner (basic check - backend will verify)
  const isSuperAdmin = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'super_admin');
  const isDev = user?.email?.endsWith('@ntg.com') || user?.email?.endsWith('@example.com');
  const isOwner = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'tenant_owner');

  if (!isSuperAdmin && !isDev && !isOwner) {
    return (
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Alert color={colors.error} title="Access Denied">
          <Text size="sm">This page is only accessible to developers and owners.</Text>
        </Alert>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '60px',
        paddingLeft: 'var(--mantine-spacing-md)',
        paddingRight: 'var(--mantine-spacing-md)',
        paddingTop: 'var(--mantine-spacing-sm)',
        paddingBottom: 'var(--mantine-spacing-xl)',
      }}
    >
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Assign Branch to Tenant</Title>
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <Paper withBorder p="md" mt="lg">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Alert color="blue" title="Developer Tool">
              <Text size="sm">
                This tool allows you to assign a new branch to an existing tenant. All{' '}
                <strong>school_admin</strong> users for the tenant will automatically be granted access
                to the new branch.
              </Text>
            </Alert>

            {tenantsQuery.isLoading ? (
              <Stack gap="md">
                <Skeleton height={40} />
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            ) : tenantsQuery.error ? (
              <Alert color={colors.error} title="Failed to load tenants">
                <Text size="sm">Please try again.</Text>
              </Alert>
            ) : (
              <>
                <Select
                  label="Tenant"
                  placeholder="Select a tenant"
                  required
                  data={
                    tenantsQuery.data?.data?.map((tenant) => ({
                      value: tenant.id,
                      label: `${tenant.name} (${tenant.code})`,
                    })) || []
                  }
                  searchable
                  {...form.getInputProps('tenantId')}
                />

                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Branch Name"
                      placeholder="Enter branch name"
                      required
                      {...form.getInputProps('name')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Branch Name (Arabic)"
                      placeholder="Enter branch name in Arabic"
                      {...form.getInputProps('nameAr')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Branch Code"
                      placeholder="Enter branch code (optional)"
                      {...form.getInputProps('code')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Address"
                      placeholder="Enter branch address"
                      {...form.getInputProps('address')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Phone"
                      placeholder="Enter branch phone"
                      {...form.getInputProps('phone')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <TextInput
                      label="Email"
                      type="email"
                      placeholder="Enter branch email"
                      {...form.getInputProps('email')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <NumberInput
                      label="Storage Quota (GB)"
                      placeholder="Enter storage quota"
                      min={1}
                      {...form.getInputProps('storageQuotaGb')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Switch
                      label="Active"
                      {...form.getInputProps('isActive', { type: 'checkbox' })}
                    />
                  </Grid.Col>
                </Grid>

                <Group justify="flex-end" mt="xl">
                  <Button type="submit" loading={assignBranch.isPending}>
                    Assign Branch
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </form>
      </Paper>
    </div>
  );
}
