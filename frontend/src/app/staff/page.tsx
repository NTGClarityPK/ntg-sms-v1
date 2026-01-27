'use client';

import { Group, Title, Loader, Stack, Alert, Text, Button, TextInput, Select } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { StaffTable } from '@/components/features/staff/StaffTable';
import { StaffForm } from '@/components/features/staff/StaffForm';
import { useStaff } from '@/hooks/useStaff';
import { useRoles } from '@/hooks/useRoles';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { Staff } from '@/types/staff';

export default function StaffPage() {
  const colors = useThemeColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);

  const { data: rolesData } = useRoles();
  const roles = rolesData?.data || [];

  const staffQuery = useStaff({
    page,
    limit: 20,
    role: roleFilter,
    search: search || undefined,
  });

  const staffResponse = staffQuery.data;
  const staffData = (staffResponse && 'data' in staffResponse ? staffResponse.data : []) as Staff[];
  const staffMeta = staffResponse && 'meta' in staffResponse ? staffResponse.meta : undefined;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <div>
            <Title order={1}>Staff Management</Title>
            <Text size="sm" c="dimmed" mt={4}>
              Manage staff members with employment details (employee ID, department, join date)
            </Text>
          </div>
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
        </Group>

        {staffQuery.isLoading || !staffQuery.data ? (
          <Group justify="center" py="xl">
            <Loader color={colors.primary} />
          </Group>
        ) : staffQuery.error ? (
          <Alert color={colors.error} title="Failed to load staff">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => staffQuery.refetch()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : staffData.length === 0 ? (
          <Alert color={colors.info} title="No staff records found">
            <Stack gap="xs" mt="sm">
              <Text size="sm">
                No staff members with employment records have been created yet.
              </Text>
              <Text size="sm" c="dimmed">
                Note: Staff records are separate from user accounts. Users with staff roles exist in User Management, but they need employment records (employee ID, department, etc.) to appear here.
              </Text>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={open}
                mt="xs"
              >
                Create Staff Record
              </Button>
            </Stack>
          </Alert>
        ) : (
          <StaffTable
            staff={staffData}
            meta={staffMeta}
            onPageChange={setPage}
          />
        )}
      </Stack>

      <StaffForm opened={opened} onClose={close} staff={null} roles={roles} />
    </>
  );
}

