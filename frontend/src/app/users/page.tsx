'use client';

import { Group, Title, Loader, Stack, Alert, Text, Button, TextInput, Select, SegmentedControl } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { UserTable } from '@/components/features/users/UserTable';
import { UserForm } from '@/components/features/users/UserForm';
import { useUsers } from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function UsersPage() {
  const colors = useThemeColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  const { data: rolesData } = useRoles();
  const roles = rolesData?.data || [];

  const usersQuery = useUsers({
    page,
    limit: 20,
    role: roleFilter,
    isActive: statusFilter,
    search: search || undefined,
  });

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Users</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create User
          </Button>
        </Group>
      </div>

      <Stack gap="md">
        <Group>
          <TextInput
            placeholder="Search users..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by role"
            data={roles.map((r) => ({ value: r.id, label: r.displayName }))}
            value={roleFilter}
            onChange={(value) => setRoleFilter(value || undefined)}
            clearable
            w={200}
          />
          <SegmentedControl
            data={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' },
            ]}
            value={
              statusFilter === undefined
                ? 'all'
                : statusFilter
                  ? 'active'
                  : 'inactive'
            }
            onChange={(value) =>
              setStatusFilter(
                value === 'all' ? undefined : value === 'active',
              )
            }
          />
        </Group>

        {usersQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader color={colors.primary} />
          </Group>
        ) : usersQuery.error ? (
          <Alert color={colors.error} title="Failed to load users">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => usersQuery.refetch()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : !usersQuery.data || !usersQuery.data.data || usersQuery.data.data.length === 0 ? (
          <Alert color={colors.info} title="No users found">
            <Text size="sm">No users have been created yet. Click "Create User" to add one.</Text>
          </Alert>
        ) : (
          <UserTable
            users={usersQuery.data.data}
            meta={usersQuery.data.meta}
            onPageChange={setPage}
          />
        )}
      </Stack>

      <UserForm opened={opened} onClose={close} roles={roles} />
    </>
  );
}

