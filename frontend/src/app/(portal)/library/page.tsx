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
  SimpleGrid,
  Box,
} from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue, useMediaQuery } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { useLibraryItems, useLibraryCategories } from '@/hooks/useLibrary';
import { useCoreLookups } from '@/hooks/useCoreLookups';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { LibraryGrid } from '@/components/features/library/LibraryGrid';
import { LibraryList } from '@/components/features/library/LibraryList';
import { UploadModal } from '@/components/features/library/UploadModal';
import type { ClassEntity } from '@/types/settings';
import { PAGE_TITLE_BAR_MOBILE_MEDIA } from '@/components/common/PageTitleBarLongTitleSizing';

export default function LibraryPage() {
  const t = useTranslations('library');
  const isMobile = useMediaQuery(PAGE_TITLE_BAR_MOBILE_MEDIA);
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
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="xs">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {t('title')}
          </Title>
          {canEdit && (
            <Box style={{ flexShrink: 0 }}>
              <Button
                id="library-btn-upload"
                size={isMobile ? 'xs' : 'sm'}
                leftSection={<IconPlus size={16} />}
                onClick={open}
              >
                {t('uploadItem')}
              </Button>
            </Box>
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
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <TextInput
                id="library-search"
                placeholder={t('searchPlaceholder')}
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => {
                  setSearch(e.currentTarget.value);
                  handleFilterChange();
                }}
              />
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                <Select
                  id="library-filter-category"
                  placeholder={t('filterByCategory')}
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
                  id="library-filter-subject"
                  placeholder={t('filterBySubject')}
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
                  id="library-filter-class"
                  placeholder={t('filterByClass')}
                  data={classes.map((c) => {
                    const classEntity = c as ClassEntity;
                    return {
                      value: classEntity.id,
                      label: classEntity.displayName || classEntity.name,
                    };
                  })}
                  value={classFilter}
                  onChange={(value) => {
                    setClassFilter(value);
                    handleFilterChange();
                  }}
                  clearable
                  searchable
                />
              </SimpleGrid>
              <Group gap="xs" wrap="wrap" className="filter-chip-group" justify="flex-start">
                <Chip.Group
                  value={viewMode}
                  onChange={(v) =>
                    setViewMode((Array.isArray(v) ? v[0] : v) === 'list' ? 'list' : 'grid')
                  }
                >
                  <Group gap="xs" wrap="wrap">
                    <Chip value="grid" variant="filled">
                      {t('grid')}
                    </Chip>
                    <Chip value="list" variant="filled">
                      {t('list')}
                    </Chip>
                  </Group>
                </Chip.Group>
              </Group>
            </Stack>
          </Paper>

          {libraryQuery.isLoading || !libraryResponse ? (
            <Stack gap="md">
              <Skeleton height={40} width="30%" />
              <Skeleton height={400} />
              <Skeleton height={50} />
            </Stack>
          ) : libraryQuery.error ? (
            <Alert color={colors.error} title={t('failedToLoad')}>
              <Group justify="space-between" mt="sm">
                <Text size="sm">{t('pleaseTryAgain')}</Text>
                <Button id="library-retry" variant="light" onClick={() => libraryQuery.refetch()}>
                  {t('retry')}
                </Button>
              </Group>
            </Alert>
          ) : !libraryResponse?.data || libraryResponse.data.length === 0 ? (
            <Alert color={colors.info} title={t('noItemsFound')}>
              <Text size="sm">{canEdit ? t('noItemsHintCanEdit') : t('noItemsHint')}</Text>
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
