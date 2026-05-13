'use client';

/**
 * Assessments List Page
 * Displays all assessments with filters and allows creation/editing
 */

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  TextInput,
  Select,
  Box,
  Skeleton,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Pagination,
  Table,
  ScrollArea,
  Chip,
  useMantineTheme,
  Tabs,
} from '@mantine/core';
import {
  IconPlus,
  IconRefresh,
  IconSearch,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconEye,
  IconChartBar,
  IconFileTypePdf,
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  useAssessments,
  useDeleteAssessment,
  useExaminationSchedule,
  useExportExaminationSchedulePdf,
} from '@/hooks/api/useAssessments';
import { useClassSections } from '@/hooks/useClassSections';
import { useAssessmentTypes } from '@/hooks/useAssessmentSettings';
import { useSubjects } from '@/hooks/useCoreLookups';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { useStaff } from '@/hooks/useStaff';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import type { Assessment } from '@/types/assessment';
import { formatExaminationDurationMinutes } from '@/lib/format-examination-duration';

function formatDueDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return dayjs(iso).format('MMM D, YYYY HH:mm');
}

export default function AssessmentsPage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { canEdit } = useFeaturePermission('assessment');
  const [mainTab, setMainTab] = useState<'all' | 'schedule'>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState<string | null>(null);
  const [assessmentTypeIdFilter, setAssessmentTypeIdFilter] = useState<string | null>(null);
  const [teacherUserId, setTeacherUserId] = useState<string | null>(null);

  const { data: activeYearResponse } = useActiveAcademicYear();
  const activeYearId = activeYearResponse?.data?.id;

  const { data: classSectionsData } = useClassSections({
    minimal: true,
    isActive: true,
    enabled: true,
  });
  const classSectionOptions =
    Array.isArray(classSectionsData?.data) && classSectionsData.data.length > 0
      ? classSectionsData.data.map((cs) => ({
          value: cs.id,
          label:
            [cs.classDisplayName ?? cs.className, cs.sectionName].filter(Boolean).join(' - ') ||
            cs.id,
        }))
      : [];

  const { data: subjectsResponse } = useSubjects();
  const subjectOptions = useMemo(() => {
    const list = subjectsResponse?.data;
    if (!Array.isArray(list)) return [];
    return list.map((s) => ({ value: s.id, label: s.name }));
  }, [subjectsResponse?.data]);

  const { data: assessmentTypesData } = useAssessmentTypes();
  const assessmentTypes = Array.isArray(assessmentTypesData?.data) ? assessmentTypesData.data : [];

  const { data: staffListResponse } = useStaff({
    page: 1,
    limit: 500,
    isActive: true,
  });
  const teacherSelectData = useMemo(() => {
    const list = staffListResponse?.data;
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => typeof s.userId === 'string' && s.userId.length > 0)
      .map((s) => ({
        value: s.userId,
        label: [s.fullName, s.email].find((x) => typeof x === 'string' && x.trim().length > 0)?.trim() ?? s.userId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [staffListResponse?.data]);

  const { data, isLoading, error, isRefetching } = useAssessments({
    page,
    limit: 20,
    search: search || undefined,
    classSectionId: classSectionId || undefined,
    subjectId: subjectId || undefined,
    assessmentTypeId: assessmentTypeIdFilter ?? undefined,
    teacherUserId: teacherUserId ?? undefined,
    status:
      isPublished === 'true' ? 'published' : isPublished === 'false' ? 'unpublished' : undefined,
  });

  const scheduleQuery = useExaminationSchedule(
    {
      page,
      limit: 20,
      sortBy: 'due_date',
      sortOrder: 'asc',
      academicYearId: activeYearId,
      classSectionId: classSectionId || undefined,
      subjectId: subjectId || undefined,
    },
    mainTab === 'schedule',
  );

  const exportPdf = useExportExaminationSchedulePdf();

  const deleteAssessment = useDeleteAssessment();

  const handleDelete = (id: string, title: string) => {
    modals.openConfirmModal({
      title: t('deleteAssessment'),
      children: (
        <Text size="sm">
          {t('deleteConfirmMessage', { title })}
        </Text>
      ),
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteAssessment.mutate(id),
    });
  };

  const scheduleRows =
    scheduleQuery.data?.data && Array.isArray(scheduleQuery.data.data) ? scheduleQuery.data.data : [];
  const scheduleMeta = scheduleQuery.data?.meta;
  const scheduleLoading = scheduleQuery.isLoading || scheduleQuery.isRefetching;

  const handleExportPdf = () => {
    const pdfLanguage = locale === 'ar' ? 'ar' : locale === 'en-US' ? 'en-US' : 'en-GB';
    exportPdf.mutate(
      {
        classSectionId: classSectionId || undefined,
        subjectId: subjectId || undefined,
        academicYearId: activeYearId,
        language: pdfLanguage,
      },
      {
        onError: () => {
          notifications.show({
            title: tCommon('error'),
            message: t('examinationScheduleExportFailed'),
            color: 'red',
          });
        },
      },
    );
  };

  const headerLoading = mainTab === 'all' ? isRefetching : scheduleQuery.isRefetching;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="sm">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {t('title')}
          </Title>
          <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label={tCommon('retry')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={headerLoading}
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['assessments'] });
                }}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {canEdit && !isMobile && (
              <Button id="assessments-btn-create" leftSection={<IconPlus size={16} />} onClick={() => router.push('/assessments/create')}>
                {t('createAssessment')}
              </Button>
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
          {canEdit && isMobile && (
            <Button
              id="assessments-btn-create-mobile"
              leftSection={<IconPlus size={16} />}
              onClick={() => router.push('/assessments/create')}
              fullWidth
              size="sm"
            >
              {t('createAssessment')}
            </Button>
          )}

          <Tabs
            value={mainTab}
            onChange={(v) => {
              const next = v === 'schedule' ? 'schedule' : 'all';
              setMainTab(next);
              setPage(1);
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="all">{t('tabAllAssessments')}</Tabs.Tab>
              <Tabs.Tab value="schedule">{t('tabExaminationSchedule')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="all" pt="md">
              <Stack gap="md">
                <Paper p="md" withBorder>
                  <Stack gap="md">
                    {isMobile ? (
                      <Stack gap="sm">
                        <TextInput
                          id="assessments-search"
                          placeholder={t('searchPlaceholder')}
                          leftSection={<IconSearch size={16} />}
                          value={search}
                          onChange={(e) => setSearch(e.currentTarget.value)}
                        />
                        <Select
                          id="assessments-filter-class-section"
                          placeholder={t('filterByClassSection')}
                          data={classSectionOptions}
                          value={classSectionId ?? null}
                          onChange={(v) => setClassSectionId(v ?? null)}
                          clearable
                        />
                        <Select
                          id="assessments-filter-status"
                          placeholder={t('filterByStatus')}
                          data={[
                            { value: 'all', label: t('all') },
                            { value: 'true', label: t('published') },
                            { value: 'false', label: t('draft') },
                          ]}
                          value={isPublished}
                          onChange={setIsPublished}
                          clearable
                        />
                        <Select
                          id="assessments-filter-teacher"
                          placeholder={t('filterByTeacher')}
                          data={teacherSelectData}
                          value={teacherUserId}
                          onChange={(v) => {
                            setTeacherUserId(v ?? null);
                            setPage(1);
                          }}
                          clearable
                          searchable
                          nothingFoundMessage={tCommon('noData')}
                        />
                      </Stack>
                    ) : (
                      <ScrollArea type="auto" scrollbars="x" w="100%">
                        <Group wrap="nowrap" gap="sm" align="flex-end" style={{ minWidth: 'min-content' }}>
                          <Box style={{ minWidth: 200, flex: '2 1 220px' }}>
                            <TextInput
                              id="assessments-search"
                              placeholder={t('searchPlaceholder')}
                              leftSection={<IconSearch size={16} />}
                              value={search}
                              onChange={(e) => setSearch(e.currentTarget.value)}
                            />
                          </Box>
                          <Box style={{ minWidth: 140, flex: '1 1 160px' }}>
                            <Select
                              id="assessments-filter-class-section"
                              placeholder={t('filterByClassSection')}
                              data={classSectionOptions}
                              value={classSectionId ?? null}
                              onChange={(v) => setClassSectionId(v ?? null)}
                              clearable
                            />
                          </Box>
                          <Box style={{ minWidth: 130, flex: '1 1 150px' }}>
                            <Select
                              id="assessments-filter-status"
                              placeholder={t('filterByStatus')}
                              data={[
                                { value: 'all', label: t('all') },
                                { value: 'true', label: t('published') },
                                { value: 'false', label: t('draft') },
                              ]}
                              value={isPublished}
                              onChange={setIsPublished}
                              clearable
                            />
                          </Box>
                          <Box style={{ minWidth: 160, flex: '1 1 180px' }}>
                            <Select
                              id="assessments-filter-teacher"
                              placeholder={t('filterByTeacher')}
                              data={teacherSelectData}
                              value={teacherUserId}
                              onChange={(v) => {
                                setTeacherUserId(v ?? null);
                                setPage(1);
                              }}
                              clearable
                              searchable
                              nothingFoundMessage={tCommon('noData')}
                            />
                          </Box>
                        </Group>
                      </ScrollArea>
                    )}

                    {isMobile ? (
                      <Box id="assessments-filter-type-container" pt="xs">
                        <Group gap="xs" wrap="wrap" className="filter-chip-group">
                          <Chip
                            id="assessments-filter-type-all"
                            checked={assessmentTypeIdFilter === null}
                            onChange={() => setAssessmentTypeIdFilter(null)}
                            variant="filled"
                          >
                            {t('all')}
                          </Chip>
                          <Chip.Group
                            value={assessmentTypeIdFilter ?? ''}
                            onChange={(value) => {
                              const val = Array.isArray(value) ? value[0] : value;
                              setAssessmentTypeIdFilter(val && val !== '' ? val : null);
                            }}
                          >
                            <Group gap="xs" wrap="wrap">
                              {assessmentTypes.map((type) => (
                                <Chip key={type.id} value={type.id} variant="filled">
                                  {type.name}
                                </Chip>
                              ))}
                            </Group>
                          </Chip.Group>
                        </Group>
                      </Box>
                    ) : (
                      <Paper p="sm" withBorder id="assessments-filter-type-container">
                        <Group gap="xs" wrap="wrap" className="filter-chip-group">
                          <Chip
                            id="assessments-filter-type-all"
                            checked={assessmentTypeIdFilter === null}
                            onChange={() => setAssessmentTypeIdFilter(null)}
                            variant="filled"
                          >
                            {t('all')}
                          </Chip>
                          <Chip.Group
                            value={assessmentTypeIdFilter ?? ''}
                            onChange={(value) => {
                              const val = Array.isArray(value) ? value[0] : value;
                              setAssessmentTypeIdFilter(val && val !== '' ? val : null);
                            }}
                          >
                            <Group gap="xs" wrap="wrap">
                              {assessmentTypes.map((type) => (
                                <Chip key={type.id} value={type.id} variant="filled">
                                  {type.name}
                                </Chip>
                              ))}
                            </Group>
                          </Chip.Group>
                        </Group>
                      </Paper>
                    )}
                  </Stack>
                </Paper>

                <Paper p="md" withBorder>
                  {isLoading || isRefetching ? (
                    <Stack gap="md">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} height={60} />
                      ))}
                    </Stack>
                  ) : error ? (
                    <Text c="red" ta="center" py="xl">
                      {t('errorLoading')}
                    </Text>
                  ) : data?.data && Array.isArray(data.data) && data.data.length > 0 ? (
                    <Stack gap="md">
                      <ScrollArea type="auto" scrollbars="x" w="100%">
                        <Table striped highlightOnHover style={{ minWidth: 720 }}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>{t('titleColumn')}</Table.Th>
                              <Table.Th>{t('status')}</Table.Th>
                              <Table.Th>{t('totalMarks')}</Table.Th>
                              <Table.Th>{t('dueDate')}</Table.Th>
                              <Table.Th style={{ textAlign: 'right' }}>{tCommon('actions')}</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {data.data.map((assessment: Assessment) => (
                              <Table.Tr key={assessment.id}>
                                <Table.Td>
                                  <Stack gap={6}>
                                    <Text fw={600} lh={1.25}>
                                      {assessment.title}
                                    </Text>
                                    <Group gap="xs" wrap="wrap">
                                      <Badge variant="light" color="blue">
                                        {t('subject')}: {assessment.subjectName ?? '—'}
                                      </Badge>
                                      <Badge variant="light" color="grape">
                                        {t('classSection')}: {assessment.classSectionName ?? '—'}
                                      </Badge>
                                      <Text size="sm" c="dimmed">
                                        {t('postedBy')}: <Text span fw={500} c="dark">{assessment.teacherName ?? '—'}</Text>
                                      </Text>
                                    </Group>
                                    {assessment.description ? (
                                      <Text size="sm" c="dimmed" lineClamp={2}>
                                        {assessment.description}
                                      </Text>
                                    ) : null}
                                  </Stack>
                                </Table.Td>
                                <Table.Td>
                                  <Badge color={assessment.isPublished ? 'green' : 'gray'}>
                                    {assessment.isPublished ? t('published') : t('draft')}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>{assessment.totalMarks}</Table.Td>
                                <Table.Td>{formatDueDateTime(assessment.dueDate)}</Table.Td>
                                <Table.Td style={{ width: 1, whiteSpace: 'nowrap' }}>
                                  <Group gap={4} justify={isMobile ? 'flex-start' : 'flex-end'} wrap="nowrap">
                                    <Tooltip label={t('viewStatistics')}>
                                      <ActionIcon
                                        variant="subtle"
                                        color="blue"
                                        size={isMobile ? 'md' : 'lg'}
                                        onClick={() => router.push(`/assessments/${assessment.id}/statistics`)}
                                      >
                                        <IconChartBar size={isMobile ? 16 : 18} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label={canEdit ? t('gradeEntry') : t('viewGrades')}>
                                      <ActionIcon
                                        variant="subtle"
                                        color="green"
                                        size={isMobile ? 'md' : 'lg'}
                                        onClick={() => router.push(`/assessments/${assessment.id}/grades`)}
                                      >
                                        <IconEye size={isMobile ? 16 : 18} />
                                      </ActionIcon>
                                    </Tooltip>
                                    {canEdit && (
                                      <Menu position="bottom-end" withinPortal>
                                        <Menu.Target>
                                          <ActionIcon variant="subtle" color="gray" size={isMobile ? 'md' : 'lg'}>
                                            <IconDotsVertical size={isMobile ? 16 : 18} />
                                          </ActionIcon>
                                        </Menu.Target>
                                        <Menu.Dropdown>
                                          <Menu.Item
                                            leftSection={<IconEdit size={14} />}
                                            onClick={() => router.push(`/assessments/${assessment.id}/edit`)}
                                          >
                                            {tCommon('edit')}
                                          </Menu.Item>
                                          <Menu.Item
                                            leftSection={<IconTrash size={14} />}
                                            color="red"
                                            onClick={() => handleDelete(assessment.id, assessment.title)}
                                          >
                                            {tCommon('delete')}
                                          </Menu.Item>
                                        </Menu.Dropdown>
                                      </Menu>
                                    )}
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>

                      {data.meta && data.meta.totalPages > 1 && (
                        <ScrollArea type="auto" scrollbars="x" w="100%" mt="md">
                          <Group justify="center" wrap="nowrap" gap={4} mx="auto" style={{ minWidth: 'min-content' }}>
                            <Pagination
                              total={data.meta.totalPages}
                              value={page}
                              onChange={setPage}
                              size={isMobile ? 'sm' : 'md'}
                              withEdges={!isMobile}
                            />
                          </Group>
                        </ScrollArea>
                      )}
                    </Stack>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">
                      {t('noAssessmentsFound')}
                    </Text>
                  )}
                </Paper>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="schedule" pt="md">
              <Stack gap="md">
                <Paper p="md" withBorder>
                  {isMobile ? (
                    <Stack gap="sm">
                      <Select
                        id="assessments-schedule-filter-class-section"
                        placeholder={t('filterByClassSection')}
                        data={classSectionOptions}
                        value={classSectionId ?? null}
                        onChange={(v) => {
                          setClassSectionId(v ?? null);
                          setPage(1);
                        }}
                        clearable
                      />
                      <Select
                        id="assessments-schedule-filter-subject"
                        placeholder={t('selectSubject')}
                        data={subjectOptions}
                        value={subjectId ?? null}
                        onChange={(v) => {
                          setSubjectId(v ?? null);
                          setPage(1);
                        }}
                        clearable
                        searchable
                      />
                      <Button
                        id="assessments-schedule-export-pdf"
                        leftSection={<IconFileTypePdf size={16} />}
                        variant="light"
                        onClick={handleExportPdf}
                        loading={exportPdf.isPending}
                      >
                        {t('examinationScheduleExportPdf')}
                      </Button>
                    </Stack>
                  ) : (
                    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
                      <Group grow style={{ flex: 1, minWidth: 260 }}>
                        <Select
                          id="assessments-schedule-filter-class-section"
                          placeholder={t('filterByClassSection')}
                          data={classSectionOptions}
                          value={classSectionId ?? null}
                          onChange={(v) => {
                            setClassSectionId(v ?? null);
                            setPage(1);
                          }}
                          clearable
                        />
                        <Select
                          id="assessments-schedule-filter-subject"
                          placeholder={t('selectSubject')}
                          data={subjectOptions}
                          value={subjectId ?? null}
                          onChange={(v) => {
                            setSubjectId(v ?? null);
                            setPage(1);
                          }}
                          clearable
                          searchable
                        />
                      </Group>
                      <Button
                        id="assessments-schedule-export-pdf"
                        leftSection={<IconFileTypePdf size={16} />}
                        variant="light"
                        onClick={handleExportPdf}
                        loading={exportPdf.isPending}
                      >
                        {t('examinationScheduleExportPdf')}
                      </Button>
                    </Group>
                  )}
                </Paper>

                <Paper p="md" withBorder>
                  {scheduleLoading ? (
                    <Stack gap="md">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} height={60} />
                      ))}
                    </Stack>
                  ) : scheduleQuery.error ? (
                    <Text c="red" ta="center" py="xl">
                      {t('errorLoading')}
                    </Text>
                  ) : scheduleRows.length > 0 ? (
                    <Stack gap="md">
                      <ScrollArea type="auto" scrollbars="x" w="100%">
                        <Table striped highlightOnHover style={{ minWidth: 640 }}>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>{t('examinationScheduleDate')}</Table.Th>
                              <Table.Th>{t('examinationScheduleTime')}</Table.Th>
                              <Table.Th>{t('examinationScheduleDuration')}</Table.Th>
                              <Table.Th>{t('examinationScheduleSubject')}</Table.Th>
                              <Table.Th>{t('examinationScheduleSyllabus')}</Table.Th>
                              <Table.Th>{t('examinationScheduleRoom')}</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {scheduleRows.map((row) => (
                              <Table.Tr key={row.id}>
                                <Table.Td>
                                  {row.dueDate ? dayjs(row.dueDate).format('MMM D, YYYY') : '—'}
                                </Table.Td>
                                <Table.Td>
                                  {row.dueDate ? dayjs(row.dueDate).format('HH:mm') : '—'}
                                </Table.Td>
                                <Table.Td>
                                  {row.examinationDurationMinutes != null &&
                                  !Number.isNaN(Number(row.examinationDurationMinutes))
                                    ? formatExaminationDurationMinutes(
                                        Number(row.examinationDurationMinutes),
                                        locale,
                                      )
                                    : '—'}
                                </Table.Td>
                                <Table.Td>{row.subjectName ?? '—'}</Table.Td>
                                <Table.Td>
                                  <Text size="sm" lineClamp={3}>
                                    {row.description?.trim() ? row.description : '—'}
                                  </Text>
                                </Table.Td>
                                <Table.Td>{row.roomNumber?.trim() ? row.roomNumber : '—'}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </ScrollArea>

                      {scheduleMeta && scheduleMeta.totalPages > 1 && (
                        <ScrollArea type="auto" scrollbars="x" w="100%" mt="md">
                          <Group justify="center" wrap="nowrap" gap={4} mx="auto" style={{ minWidth: 'min-content' }}>
                            <Pagination
                              total={scheduleMeta.totalPages}
                              value={page}
                              onChange={setPage}
                              size={isMobile ? 'sm' : 'md'}
                              withEdges={!isMobile}
                            />
                          </Group>
                        </ScrollArea>
                      )}
                    </Stack>
                  ) : (
                    <Text c="dimmed" ta="center" py="xl">
                      {t('examinationScheduleEmpty')}
                    </Text>
                  )}
                </Paper>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </div>
    </>
  );
}
