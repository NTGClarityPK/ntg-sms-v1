'use client';

import { Group, Title, Loader, Stack, Alert, Text, Button, TextInput, MultiSelect } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { StudentTable } from '@/components/features/students/StudentTable';
import { StudentForm } from '@/components/features/students/StudentForm';
import { useStudents } from '@/hooks/useStudents';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { ClassEntity } from '@/types/settings';
import type { Student } from '@/types/students';

export default function StudentsPage() {
  const colors = useThemeColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300); // Debounce search by 300ms
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  const { data: classesData } = useCoreLookups('classes');
  const { data: sectionsData } = useCoreLookups('sections');
  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];

  const studentsQuery = useStudents({
    page,
    limit: 20,
    classIds: classFilter.length > 0 ? classFilter : undefined,
    sectionIds: sectionFilter.length > 0 ? sectionFilter : undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
  });

  const studentsResponse = studentsQuery.data as
    | {
        data?: Student[];
        meta?: { total: number; page: number; limit: number; totalPages: number };
      }
    | null
    | undefined;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <div>
            <Title order={1}>Student Management</Title>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Create Student
          </Button>
        </Group>
      </div>

      <Stack gap="md">
        <Group>
          <TextInput
            placeholder="Search students..."
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
              placeholder="Filter by class"
              data={classes.map((c) => {
                const classEntity = c as ClassEntity;
                return { value: classEntity.id, label: classEntity.displayName || classEntity.name };
              })}
              value={classFilter}
              onChange={(value) => {
                setClassFilter(value);
                handleFilterChange();
              }}
              clearable
              searchable
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ width: 180, flexShrink: 0 }}>
            <MultiSelect
              placeholder="Filter by section"
              data={sections.map((s) => ({ value: s.id, label: s.name }))}
              value={sectionFilter}
              onChange={(value) => {
                setSectionFilter(value);
                handleFilterChange();
              }}
              clearable
              searchable
              style={{ width: '100%' }}
            />
          </div>
        </Group>

        {studentsQuery.isLoading || !studentsResponse ? (
          <Group justify="center" py="xl">
            <Loader color={colors.primary} />
          </Group>
        ) : studentsQuery.error ? (
          <Alert color={colors.error} title="Failed to load students">
            <Group justify="space-between" mt="sm">
              <Text size="sm">Please try again.</Text>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => studentsQuery.refetch()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : !studentsResponse?.data || studentsResponse.data.length === 0 ? (
          <Alert color={colors.info} title="No students found">
            <Text size="sm">No students have been created yet. Click "Create Student" to add one.</Text>
          </Alert>
        ) : (
          <StudentTable
            students={studentsResponse.data}
            meta={studentsResponse.meta}
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

      <StudentForm opened={opened} onClose={close} />
    </>
  );
}

