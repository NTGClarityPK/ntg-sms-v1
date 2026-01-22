'use client';

import { Group, Title, Loader, Stack, Alert, Text, Button, TextInput, Select } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { StudentTable } from '@/components/features/students/StudentTable';
import { StudentForm } from '@/components/features/students/StudentForm';
import { useStudents } from '@/hooks/useStudents';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function StudentsPage() {
  const colors = useThemeColors();
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<string | undefined>(undefined);
  const [sectionFilter, setSectionFilter] = useState<string | undefined>(undefined);

  const { data: classesData } = useCoreLookups('classes');
  const { data: sectionsData } = useCoreLookups('sections');
  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];

  const studentsQuery = useStudents({
    page,
    limit: 20,
    classId: classFilter,
    sectionId: sectionFilter,
    search: search || undefined,
  });

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Students</Title>
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
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Filter by class"
            data={classes.map((c) => ({ value: c.id, label: c.displayName }))}
            value={classFilter}
            onChange={(value) => setClassFilter(value || undefined)}
            clearable
            w={200}
          />
          <Select
            placeholder="Filter by section"
            data={sections.map((s) => ({ value: s.id, label: s.name }))}
            value={sectionFilter}
            onChange={(value) => setSectionFilter(value || undefined)}
            clearable
            w={200}
          />
        </Group>

        {studentsQuery.isLoading ? (
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
        ) : !studentsQuery.data || !studentsQuery.data.data || studentsQuery.data.data.length === 0 ? (
          <Alert color={colors.info} title="No students found">
            <Text size="sm">No students have been created yet. Click "Create Student" to add one.</Text>
          </Alert>
        ) : (
          <StudentTable
            students={studentsQuery.data.data}
            meta={studentsQuery.data.meta}
            onPageChange={setPage}
          />
        )}
      </Stack>

      <StudentForm opened={opened} onClose={close} />
    </>
  );
}

