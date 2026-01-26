'use client';

import { Group, Title, Loader, Stack, Alert, Text, Button, TextInput, MultiSelect, SegmentedControl } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState, useMemo } from 'react';
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
  const [debouncedSearch] = useDebouncedValue(search, 300); // Debounce search by 300ms
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data: rolesData } = useRoles();
  const roles = rolesData?.data || [];
  
  // Filter out student role from the dropdown
  const staffRoles = useMemo(() => {
    return roles.filter((role) => role.name !== 'student');
  }, [roles]);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  const usersQuery = useUsers({
    page,
    limit: 20,
    roles: roleFilter.length > 0 ? roleFilter : undefined,
    isActive: statusFilter,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
  });

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Staff</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create Staff
          </Button>
        </Group>
      </div>

      <Stack gap="md">
        <Group>
          <TextInput
            placeholder="Search staff..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleFilterChange();
            }}
            style={{ flex: 1 }}
          />
          <div style={{ width: 200, flexShrink: 0 }}>
            <MultiSelect
              placeholder="Filter by role"
              data={staffRoles.map((r) => ({ value: r.id, label: r.displayName }))}
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value);
                handleFilterChange();
              }}
              clearable
              searchable
              maxDisplayedValues={3}
              style={{ width: '100%' }}
            />
          </div>
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
            onChange={(value) => {
              setStatusFilter(
                value === 'all' ? undefined : value === 'active',
              );
              handleFilterChange();
            }}
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
          <Alert color={colors.info} title="No staff found">
            <Text size="sm">No staff members have been created yet. Click "Create Staff" to add one.</Text>
          </Alert>
        ) : (
          <UserTable
            users={usersQuery.data.data}
            meta={usersQuery.data.meta}
            onPageChange={setPage}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={(field) => {
              if (sortBy === field) {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy(field);
                setSortOrder('asc');
              }
              setPage(1); // Reset to first page when sorting changes
            }}
          />
        )}
      </Stack>

      <UserForm opened={opened} onClose={close} roles={staffRoles} />
    </>
  );
}

