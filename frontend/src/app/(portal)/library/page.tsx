'use client';

import { useState } from 'react';
import {
  Group,
  Title,
  Button,
  Stack,
  TextInput,
  Select,
  Paper,
  Skeleton,
  Alert,
  Text,
  Chip,
} from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useLibraryItems, useLibraryCategories } from '@/hooks/useLibrary';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { LibraryGrid } from '@/components/features/library/LibraryGrid';
import { LibraryList } from '@/components/features/library/LibraryList';
import { UploadModal } from '@/components/features/library/UploadModal';
import type { ClassEntity } from '@/types/settings';

export default function LibraryPage() {
  const colors = useThemeColors();
  const { canEdit } = useFeaturePermission('library');
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: categoriesData } = useLibraryCategories();
  const categories = categoriesData || [];
  const { data: subjectsData } = useCoreLookups('subjects');
  const subjects = subjectsData?.data || [];
  const { data: classesData } = useCoreLookups('classes');
  const classes = classesData?.data || [];

  const libraryQuery = useLibraryItems({
    page,
    limit: 20,
    category: categoryFilter || undefined,
    subjectId: subjectFilter || undefined,
    classId: classFilter || undefined,
    search: debouncedSearch || undefined,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const libraryResponse = libraryQuery.data as
    | {
        data?: Array<{
          id: string;
          title: string;
          author?: string;
          description?: string;
          category: string;
          fileUrl: string;
          fileName: string;
          thumbnailUrl?: string;
          viewCount: number;
          downloadCount: number;
        }>;
        meta?: { total: number; page: number; limit: number; totalPages: number };
      }
    | null
    | undefined;

  const handleFilterChange = () => {
    setPage(1);
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Library</Title>
          {canEdit && (
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              Upload Item
            </Button>
          )}
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
          {/* Filters */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group grow>
                <TextInput
                  placeholder="Search library items..."
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.currentTarget.value);
                    handleFilterChange();
                  }}
                />
                <Select
                  placeholder="Filter by category"
                  data={categories.map((cat) => ({ value: cat, label: cat }))}
                  value={categoryFilter}
                  onChange={(value) => {
                    setCategoryFilter(value);
                    handleFilterChange();
                  }}
                  clearable
                  searchable
                />
                <Select
                  placeholder="Filter by subject"
                  data={subjects.map((s) => ({ value: s.id, label: s.name }))}
                  value={subjectFilter}
                  onChange={(value) => {
                    setSubjectFilter(value);
                    handleFilterChange();
                  }}
                  clearable
                  searchable
                />
                <Select
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
                />
                <Group gap="xs" wrap="wrap" className="filter-chip-group">
                  <Chip.Group
                    value={viewMode}
                    onChange={(v) => setViewMode((Array.isArray(v) ? v[0] : v) ?? 'grid')}
                  >
                    <Group gap="xs" wrap="wrap">
                      <Chip value="grid" variant="filled">
                        Grid
                      </Chip>
                      <Chip value="list" variant="filled">
                        List
                      </Chip>
                    </Group>
                  </Chip.Group>
                </Group>
              </Group>
            </Stack>
          </Paper>

          {/* Library Items */}
          {libraryQuery.isLoading || !libraryResponse ? (
            <Stack gap="md">
              <Skeleton height={40} width="30%" />
              <Skeleton height={400} />
              <Skeleton height={50} />
            </Stack>
          ) : libraryQuery.error ? (
            <Alert color={colors.error} title="Failed to load library items">
              <Group justify="space-between" mt="sm">
                <Text size="sm">Please try again.</Text>
                <Button variant="light" onClick={() => libraryQuery.refetch()}>
                  Retry
                </Button>
              </Group>
            </Alert>
          ) : !libraryResponse?.data || libraryResponse.data.length === 0 ? (
            <Alert color={colors.info} title="No library items found">
              <Text size="sm">
                {canEdit
                  ? 'No library items have been uploaded yet. Click "Upload Item" to add one.'
                  : 'No library items have been uploaded yet.'}
              </Text>
            </Alert>
          ) : viewMode === 'grid' ? (
            <LibraryGrid
              items={libraryResponse.data}
              meta={libraryResponse.meta}
              onPageChange={setPage}
              canEdit={canEdit}
            />
          ) : (
            <LibraryList
              items={libraryResponse.data}
              meta={libraryResponse.meta}
              onPageChange={setPage}
              canEdit={canEdit}
            />
          )}
        </Stack>
      </div>

      {canEdit && <UploadModal opened={opened} onClose={close} />}
    </>
  );
}
