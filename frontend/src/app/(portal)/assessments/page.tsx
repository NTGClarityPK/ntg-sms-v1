'use client';

/**
 * Assessments List Page
 * Displays all assessments with filters and allows creation/editing
 */

import { useState } from 'react';
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
import { IconPlus, IconSearch, IconDotsVertical, IconEdit, IconTrash, IconEye, IconChartBar } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useAssessments, useDeleteAssessment } from '@/hooks/api/useAssessments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import type { Assessment } from '@/types/assessment';

export default function AssessmentsPage() {
  const router = useRouter();
  const { canEdit } = useFeaturePermission('assessment');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState<string | null>(null);

  const { data, isLoading, error } = useAssessments({
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
      title: 'Delete Assessment',
      children: (
        <Text size="sm">
          Are you sure you want to delete the assessment <strong>{title}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteAssessment.mutate(id),
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Assessments</Title>
          {canEdit && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/assessments/create')}>
              Create Assessment
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
                placeholder="Search assessments..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />
              <Select
                placeholder="Filter by status"
                data={[
                  { value: 'all', label: 'All' },
                  { value: 'true', label: 'Published' },
                  { value: 'false', label: 'Unpublished' },
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
          {isLoading ? (
            <Stack gap="md">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height={60} />
              ))}
            </Stack>
          ) : error ? (
            <Text c="red" ta="center" py="xl">
              Error loading assessments. Please try again.
            </Text>
          ) : data?.data && Array.isArray(data.data) && data.data.length > 0 ? (
            <Stack gap="md">
              <ScrollArea>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Total Marks</Table.Th>
                      <Table.Th>Due Date</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Actions</Table.Th>
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
                            {assessment.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </Table.Td>
                        <Table.Td>{assessment.totalMarks}</Table.Td>
                        <Table.Td>
                          {assessment.dueDate ? dayjs(assessment.dueDate).format('MMM D, YYYY') : '—'}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" justify="flex-end">
                            <Tooltip label="View Statistics">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => router.push(`/assessments/${assessment.id}/statistics`)}
                              >
                                <IconChartBar size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Grade Entry">
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
                                    Edit
                                  </Menu.Item>
                                  <Menu.Item
                                    leftSection={<IconTrash size={14} />}
                                    color="red"
                                    onClick={() => handleDelete(assessment.id, assessment.title)}
                                  >
                                    Delete
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
              No assessments found. Create your first assessment to get started.
            </Text>
          )}
        </Paper>
        </Stack>
      </div>
    </>
  );
}

