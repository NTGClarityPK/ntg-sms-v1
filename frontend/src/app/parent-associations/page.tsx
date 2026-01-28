'use client';

import { Box, Flex, Group, Title, Loader, Stack, Alert, Text, Button, TextInput, Select } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { ParentAssociationTable } from '@/components/features/parents/ParentAssociationTable';
import { CreateParentAssociationModal } from '@/components/features/parents/CreateParentAssociationModal';
import { useParentAssociations } from '@/hooks/useParentAssociations';
import { useUsers } from '@/hooks/useUsers';
import { useStudents } from '@/hooks/useStudents';
import { useRoles } from '@/hooks/useRoles';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function ParentAssociationsPage() {
  const colors = useThemeColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [parentFilter, setParentFilter] = useState<string | undefined>(undefined);
  const [studentFilter, setStudentFilter] = useState<string | undefined>(undefined);

  // Fetch roles to get parent role ID
  const { data: rolesData } = useRoles();
  const parentRoleId = useMemo(() => {
    if (!rolesData?.data) return undefined;
    const parentRole = rolesData.data.find((r) => r.name === 'parent');
    return parentRole?.id;
  }, [rolesData]);

  // Fetch parents and students for filters
  const { data: usersData } = useUsers({
    roles: parentRoleId ? [parentRoleId] : undefined,
  });
  // Backend caps limit at 100 via DTO validation
  const { data: studentsData } = useStudents({ page: 1, limit: 100 });

  const parents = usersData?.data || [];
  const students = studentsData?.data || [];

  // Filter by search term
  const filteredParentId = useMemo(() => {
    if (!debouncedSearch || !parents.length) return parentFilter;
    const found = parents.find(
      (p) =>
        p.fullName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        p.email?.toLowerCase().includes(debouncedSearch.toLowerCase()),
    );
    return found?.id || parentFilter;
  }, [debouncedSearch, parents, parentFilter]);

  const associationsQuery = useParentAssociations({
    page,
    limit: 20,
    parentId: filteredParentId,
    studentId: studentFilter,
  });

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Parent-Student Associations</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create Association
          </Button>
        </Group>
      </div>

      <Stack gap="md">
        <Flex gap="md" wrap="wrap" align="flex-end">
          <TextInput
            placeholder="Search by parent name or email..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            flex={1}
            miw={260}
          />
          <Box w={250}>
            <Select
              placeholder="Filter by parent"
              data={parents.map((p) => ({
                value: p.id,
                label: `${p.fullName}${p.email ? ` (${p.email})` : ''}`,
              }))}
              value={parentFilter}
              onChange={(value) => {
                setParentFilter(value || undefined);
                setSearch(''); // Clear search when filter changes
                setPage(1);
              }}
              clearable
              searchable
              w="100%"
            />
          </Box>
          <Box w={250}>
            <Select
              placeholder="Filter by student"
              data={students.map((s) => ({
                value: s.id,
                label: `${s.fullName || 'N/A'} (${s.studentId})`,
              }))}
              value={studentFilter}
              onChange={(value) => {
                setStudentFilter(value || undefined);
                setPage(1);
              }}
              clearable
              searchable
              w="100%"
            />
          </Box>
        </Flex>

        {associationsQuery.isLoading || !associationsQuery.data ? (
          <Group justify="center" py="xl">
            <Loader color={colors.primary} />
          </Group>
        ) : associationsQuery.error ? (
          <Alert color={colors.error} title="Failed to load associations">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => associationsQuery.refetch()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : !associationsQuery.data.data || associationsQuery.data.data.length === 0 ? (
          <Alert color={colors.info} title="No associations found">
            <Text size="sm">
              No parent-student associations have been created yet. Click "Create Association" to add
              one.
            </Text>
          </Alert>
        ) : (
          <ParentAssociationTable
            associations={associationsQuery.data.data}
            meta={associationsQuery.data.meta}
            onPageChange={setPage}
          />
        )}
      </Stack>

      <CreateParentAssociationModal opened={opened} onClose={close} />
    </>
  );
}


