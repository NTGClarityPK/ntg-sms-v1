'use client';

import { Group, Title, Skeleton, Stack, Alert, Text, Button, TextInput, MultiSelect, Tooltip, ActionIcon } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch, IconUpload } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { StudentTable } from '@/components/features/students/StudentTable';
import { StudentForm } from '@/components/features/students/StudentForm';
import { useStudents } from '@/hooks/useStudents';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { ClassEntity } from '@/types/settings';
import type { Student } from '@/types/students';

export default function StudentsPage() {
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const tStudents = useTranslations('students');
  const { canEdit } = useFeaturePermission('students');
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
            <Title order={1}>{tStudents('title')}</Title>
          </div>
          <Group gap="sm">
            <Tooltip label={tStudents('refresh')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={studentsQuery.isRefetching}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['students'] })}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {canEdit && (
              <>
                <Button id="students-link-bulk-import" component={Link} href="/students/bulk-import" variant="light" leftSection={<IconUpload size={16} />}>
                  {tStudents('bulkImport')}
                </Button>
                <Button id="students-btn-create" leftSection={<IconPlus size={16} />} onClick={open}>
                  {tStudents('createStudent')}
                </Button>
              </>
            )}
          </Group>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          {!canEdit && (
            <Alert color={colors.info} title={tStudents('viewOnly')}>
              <Text size="sm">
                {tStudents('viewOnlyMessage')}
              </Text>
            </Alert>
          )}

          <Group>
            <TextInput
              id="students-search"
              placeholder={tStudents('searchPlaceholder')}
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
                id="students-filter-class"
                placeholder={tStudents('filterByClass')}
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
                id="students-filter-section"
                placeholder={tStudents('filterBySection')}
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

          {studentsQuery.isLoading || studentsQuery.isRefetching || !studentsResponse ? (
            <Stack gap="md">
              <Skeleton height={40} width="30%" />
              <Skeleton height={400} />
              <Skeleton height={50} />
            </Stack>
          ) : studentsQuery.error ? (
            <Alert color={colors.error} title={tStudents('failedToLoad')}>
              <Group justify="space-between" mt="sm">
                <Text size="sm">{tStudents('pleaseTryAgain')}</Text>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => studentsQuery.refetch()}
                >
                  {tStudents('retry')}
                </Button>
              </Group>
            </Alert>
          ) : !studentsResponse?.data || studentsResponse.data.length === 0 ? (
            <Alert color={colors.info} title={tStudents('noStudentsFound')}>
              <Text size="sm">
                {canEdit
                  ? tStudents('noStudentsCreateHint')
                  : tStudents('noStudentsViewOnly')}
              </Text>
            </Alert>
          ) : (
            <>
              <Text size="sm" c="dimmed">
                {tStudents('studentCount', { count: studentsResponse.meta?.total ?? studentsResponse.data.length })}
              </Text>
              <StudentTable
                canEdit={canEdit}
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
            </>
          )}
        </Stack>
      </div>

      <StudentForm opened={opened} onClose={close} />
    </>
  );
}

