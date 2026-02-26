'use client';

/**
 * Assessments List Page
 * Displays all assessments with filters and allows creation/editing
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
} from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch, IconDotsVertical, IconEdit, IconTrash, IconEye, IconChartBar } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAssessments, useDeleteAssessment } from '@/hooks/api/useAssessments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import type { Assessment } from '@/types/assessment';

export default function AssessmentsPage() {
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const router = useRouter();
  const { canEdit } = useFeaturePermission('assessment');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState<string | null>(null);

  const { data, isLoading, error, isRefetching } = useAssessments({
    page,
    limit: 20,
    search: search || undefined,
    classSectionId: classSectionId || undefined,
    subjectId: subjectId || undefined,
    isPublished: isPublished === 'true' ? true : isPublished === 'false' ? false : undefined,
  });

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

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
          <Group gap="sm">
            <Tooltip label={tCommon('retry')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={isRefetching}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['assessments'] })}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {canEdit && (
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
          {/* Filters */}
          <Paper p="md" withBorder>
          <Stack gap="md">
            <Group grow>
              <TextInput
                id="assessments-search"
                placeholder={t('searchPlaceholder')}
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
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
            </Group>
          </Stack>
        </Paper>

        {/* Assessments Table */}
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
              <ScrollArea>
                <Table striped highlightOnHover>
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
                          <Box>
                            <Text fw={500}>{assessment.title}</Text>
                            {assessment.description && (
                              <Text size="sm" c="dimmed" lineClamp={1}>
                                {assessment.description}
                              </Text>
                            )}
                          </Box>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={assessment.isPublished ? 'green' : 'gray'}>
                            {assessment.isPublished ? t('published') : t('draft')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{assessment.totalMarks}</Table.Td>
                        <Table.Td>
                          {assessment.dueDate ? dayjs(assessment.dueDate).format('MMM D, YYYY') : '—'}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="flex-end">
                            <Tooltip label={t('viewStatistics')}>
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => router.push(`/assessments/${assessment.id}/statistics`)}
                              >
                                <IconChartBar size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label={canEdit ? t('gradeEntry') : t('viewGrades')}>
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                onClick={() => router.push(`/assessments/${assessment.id}/grades`)}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {canEdit && (
                              <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                  <ActionIcon variant="subtle" color="gray">
                                    <IconDotsVertical size={16} />
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

              {/* Pagination */}
              {data.meta && data.meta.totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination total={data.meta.totalPages} value={page} onChange={setPage} />
                </Group>
              )}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              {t('noAssessmentsFound')}
            </Text>
          )}
        </Paper>
        </Stack>
      </div>
    </>
  );
}

