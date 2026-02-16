'use client';

import { Alert, Button, Group, Paper, Skeleton, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/hooks/useAuth';
import {
  useSubjectTemplates,
  useCreateSubjectTemplate,
  useUpdateSubjectTemplate,
  useDeleteSubjectTemplate,
  useAssignClassesToTemplate,
  useAssignLevelsToTemplate,
} from '@/hooks/useSubjectTemplates';
import { SubjectTemplateForm, type SubjectTemplateFormValues } from '@/components/features/settings/SubjectTemplateForm';
import { SubjectTemplateCard } from '@/components/features/settings/SubjectTemplateCard';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { SubjectTemplate } from '@/types/subject-templates';
import { Pagination } from '@mantine/core';

export default function SubjectTemplatesPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;

  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editEntity, setEditEntity] = useState<SubjectTemplate | null>(null);
  const [page, setPage] = useState(1);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  const templatesQuery = useSubjectTemplates(branchId ?? null, page, 20, debouncedSearch || undefined);
  const createTemplate = useCreateSubjectTemplate();
  const updateTemplate = useUpdateSubjectTemplate();
  const deleteTemplate = useDeleteSubjectTemplate();
  const assignClasses = useAssignClassesToTemplate();
  const assignLevels = useAssignLevelsToTemplate();

  // Debug: Log the query data structure
  if (typeof window !== 'undefined' && templatesQuery.data) {
    console.log('Templates query data:', templatesQuery.data);
    console.log('Templates query data.data:', templatesQuery.data?.data);
    console.log('Templates query data.meta:', templatesQuery.data?.meta);
  }

  const isLoading = templatesQuery.isLoading;
  const hasError = templatesQuery.error;

  const handleCreate = async (values: SubjectTemplateFormValues) => {
    try {
      const created = await createTemplate.mutateAsync({
        name: values.name,
        description: values.description,
        subjectIds: values.subjectIds,
      });

      // Assign classes and levels if provided
      if (values.classIds.length > 0 || values.levelIds.length > 0) {
        const templateId = created.data?.id;
        if (templateId) {
          if (values.classIds.length > 0) {
            await assignClasses.mutateAsync({
              templateId,
              classIds: values.classIds,
            });
          }
          if (values.levelIds.length > 0) {
            await assignLevels.mutateAsync({
              templateId,
              levelIds: values.levelIds,
            });
          }
        }
      }

      notifications.show({
        title: 'Success',
        message: 'Subject template created',
        color: notifyColors.success,
      });
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleEdit = (template: SubjectTemplate) => {
    setEditEntity(template);
    openCreate();
  };

  const handleUpdate = async (values: SubjectTemplateFormValues) => {
    if (!editEntity) return;

    try {
      await updateTemplate.mutateAsync({
        id: editEntity.id,
        input: {
          name: values.name,
          description: values.description,
          subjectIds: values.subjectIds,
        },
      });

      // Always update class and level assignments
      // Call assignClasses even if classIds is empty (to clear assignments)
      await assignClasses.mutateAsync({
        templateId: editEntity.id,
        classIds: values.classIds,
      });
      
      // Call assignLevels even if levelIds is empty (to clear assignments)
      await assignLevels.mutateAsync({
        templateId: editEntity.id,
        levelIds: values.levelIds,
      });

      notifications.show({
        title: 'Success',
        message: 'Subject template updated',
        color: notifyColors.success,
      });
      setEditEntity(null);
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleDelete = async (template: SubjectTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      await deleteTemplate.mutateAsync(template.id);
      notifications.show({
        title: 'Success',
        message: 'Subject template deleted',
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleClose = () => {
    setEditEntity(null);
    closeCreate();
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Subject Template</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Template
          </Button>
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
        {isLoading ? (
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={200} />
            <Skeleton height={200} />
          </Stack>
        ) : hasError ? (
          <Alert color={colors.error} title="Failed to load subject templates">
            <Group justify="flex-end" mt="sm">
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => templatesQuery.refetch()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        ) : (
          <Stack gap="md">
            <TextInput
              placeholder="Search templates..."
              leftSection={<IconSearch size={16} />}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setPage(1);
              }}
            />

            {(templatesQuery.data?.data ?? []).length === 0 ? (
              <Paper p="xl" withBorder>
                <Stack align="center" gap="sm">
                  <Text c="dimmed">No subject templates found</Text>
                  <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                    Create First Template
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <>
                <Stack gap="md">
                  {(templatesQuery.data?.data ?? []).map((template) => (
                    <SubjectTemplateCard
                      key={template.id}
                      template={template}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isDeleting={deleteTemplate.isPending}
                    />
                  ))}
                </Stack>

                {templatesQuery.data?.meta && templatesQuery.data.meta.totalPages > 1 && (
                  <Group justify="center" mt="md">
                    <Pagination
                      value={page}
                      onChange={setPage}
                      total={templatesQuery.data.meta.totalPages}
                    />
                  </Group>
                )}
              </>
            )}
          </Stack>
        )}
      </div>

      <SubjectTemplateForm
        opened={createOpened}
        onClose={handleClose}
        onSubmit={editEntity ? handleUpdate : handleCreate}
        isSubmitting={createTemplate.isPending || updateTemplate.isPending}
        entity={editEntity}
      />
    </>
  );
}

