'use client';

import { Alert, Button, Group, Paper, Skeleton, Stack, Text, TextInput } from '@mantine/core';
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
import { useTranslations } from 'next-intl';

export function SubjectTemplatesTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
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

  const isLoading = templatesQuery.isLoading;
  const hasError = templatesQuery.error;

  const handleCreate = async (values: SubjectTemplateFormValues) => {
    try {
      const created = await createTemplate.mutateAsync({
        name: values.name,
        description: values.description,
        subjectIds: values.subjectIds,
      });

      if (values.classIds.length > 0 || values.levelIds.length > 0) {
        const templateId = created.data?.id;
        if (templateId) {
          if (values.classIds.length > 0) {
            await assignClasses.mutateAsync({ templateId, classIds: values.classIds });
          }
          if (values.levelIds.length > 0) {
            await assignLevels.mutateAsync({ templateId, levelIds: values.levelIds });
          }
        }
      }

      notifications.show({
        title: tCommon('success'),
        message: tSettings('subjectTemplateCreated'),
        color: notifyColors.success,
      });
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
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

      await assignClasses.mutateAsync({ templateId: editEntity.id, classIds: values.classIds });
      await assignLevels.mutateAsync({ templateId: editEntity.id, levelIds: values.levelIds });

      notifications.show({
        title: tCommon('success'),
        message: tSettings('subjectTemplateUpdated'),
        color: notifyColors.success,
      });
      setEditEntity(null);
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleDelete = async (template: SubjectTemplate) => {
    if (!confirm(tSettings('subjectTemplateDeleteConfirm', { name: template.name }))) return;

    try {
      await deleteTemplate.mutateAsync(template.id);
      notifications.show({
        title: tCommon('success'),
        message: tSettings('subjectTemplateDeleted'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const handleClose = () => {
    setEditEntity(null);
    closeCreate();
  };

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="lg" fw={500}>{tSettings('subjectTemplateTitle')}</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('subjectTemplateNewButton')}
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {tSettings('subjectTemplateDescription')}
      </Text>

      {isLoading ? (
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </Stack>
      ) : hasError ? (
        <Alert color={colors.error} title={tSettings('subjectTemplateLoadError')}>
          <Group justify="flex-end" mt="sm">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => templatesQuery.refetch()}
            >
              {tCommon('retry')}
            </Button>
          </Group>
        </Alert>
      ) : (
        <Stack gap="md">
          <TextInput
            placeholder={tSettings('subjectTemplateSearchPlaceholder')}
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
                <Text c="dimmed">{tSettings('subjectTemplateNoData')}</Text>
                <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
                  {tSettings('subjectTemplateCreateFirstButton')}
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
