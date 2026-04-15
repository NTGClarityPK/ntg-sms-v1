'use client';

import { Alert, ActionIcon, Button, Group, Skeleton, Modal, MultiSelect, Paper, Stack, Table, Text, TextInput, List } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { fetchLevelDeletionStatus, useClasses, useCreateLevel, useDeleteLevel, useLevels, useUpdateLevel } from '@/hooks/useCoreLookups';
import { useIsSchoolAdminForCurrentBranch } from '@/hooks/useSchoolAdminBranch';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { AcademicEntityDeletionStatus, Level } from '@/types/settings';
import { useTranslations } from 'next-intl';

export function LevelManager() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tBlockers = useTranslations('settings.academicDeleteBlockers');
  const [opened, { open, close }] = useDisclosure(false);
  const [editLevel, setEditLevel] = useState<Level | null>(null);
  const isSchoolAdminBranch = useIsSchoolAdminForCurrentBranch();
  const levelsQuery = useLevels();
  const classesQuery = useClasses();
  const createMutation = useCreateLevel();
  const updateMutation = useUpdateLevel();
  const deleteMutation = useDeleteLevel();
  const [blockerModal, setBlockerModal] = useState<{ opened: boolean; status: AcademicEntityDeletionStatus | null }>({
    opened: false,
    status: null,
  });
  const [deletionCheckLoadingId, setDeletionCheckLoadingId] = useState<string | null>(null);

  const knownBlockerTypes = new Set([
    'level_subject_template_assignments',
  ]);

  const blockerLabel = (type: string, count: number): string => {
    if (knownBlockerTypes.has(type)) {
      return tBlockers(type as any, { count });
    }
    return tSettings('academicDeleteBlockedUnknown', { type, count });
  };

  const openDeleteLevel = async (l: Level) => {
    setDeletionCheckLoadingId(l.id);
    try {
      const status = await fetchLevelDeletionStatus(l.id);
      if (status.canDelete) {
        modals.openConfirmModal({
          title: tSettings('academicDeleteConfirmAction'),
          children: <Text size="sm">{tSettings('academicDeleteConfirmLevel', { name: l.name })}</Text>,
          labels: { confirm: tSettings('academicDeleteConfirmAction'), cancel: tCommon('cancel') },
          confirmProps: { color: 'red' },
          onConfirm: async () => {
            try {
              await deleteMutation.mutateAsync(l.id);
              notifications.show({
                title: tCommon('success'),
                message: tSettings('levelDeleted'),
                color: notifyColors.success,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : tCommon('errors.generic');
              notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
            }
          },
        });
      } else {
        setBlockerModal({ opened: true, status });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    } finally {
      setDeletionCheckLoadingId(null);
    }
  };

  const form = useForm<{ name: string; classIds: string[] }>({
    initialValues: { name: '', classIds: [] },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('levelNameRequired') : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), classIds: v.classIds }),
  });

  const openCreate = () => {
    setEditLevel(null);
    form.setValues({ name: '', classIds: [] });
    open();
  };

  const openEdit = (l: Level) => {
    setEditLevel(l);
    form.setValues({ name: l.name, classIds: l.classes.map((c) => c.id) });
    open();
  };

  const handleClose = () => {
    close();
    setEditLevel(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      if (editLevel) {
        await updateMutation.mutateAsync({
          id: editLevel.id,
          payload: { name: values.name },
        });
        notifications.show({ title: tCommon('success'), message: tSettings('levelUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: tCommon('success'), message: tSettings('levelCreated'), color: notifyColors.success });
      }
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  });

  if (levelsQuery.isLoading || classesQuery.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={50} />
      </Stack>
    );
  }

  if (levelsQuery.error || classesQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('levelLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button
            id="level-manager-retry"
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void levelsQuery.refetch();
              void classesQuery.refetch();
            }}
          >
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const levels = levelsQuery.data?.data ?? [];
  const classes = classesQuery.data?.data ?? [];

  const assignedClassIds = new Set<string>();
  const classToLevelMap = new Map<string, string>();
  levels.forEach((level) => {
    level.classes.forEach((cls) => {
      assignedClassIds.add(cls.id);
      classToLevelMap.set(cls.id, level.name);
    });
  });

  const editingLevelId = editLevel?.id;
  const editingLevelClassIds = editLevel ? new Set(editLevel.classes.map((c) => c.id)) : new Set<string>();

  const classOptions = classes.map((c) => {
    const isAssigned = assignedClassIds.has(c.id);
    const levelName = classToLevelMap.get(c.id);
    const isInEditingLevel = editingLevelId && editingLevelClassIds.has(c.id);
    const disabled = isAssigned && !isInEditingLevel;
    return {
      value: c.id,
      label:
        isAssigned && !isInEditingLevel
          ? `${c.displayName} (${tSettings('levelClassesInLabel', { levelName: levelName ?? '' })})`
          : c.displayName,
      disabled,
    };
  });

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Text size="lg" fw={500}>{tSettings('levelTitle')}</Text>
        <Button id="level-manager-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('levelAddButton')}
        </Button>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {tSettings('levelDescription')}
      </Text>

      <Paper withBorder p="md">
        {levels.length === 0 ? (
          <Text c="dimmed" size="sm">
            {tSettings('levelNoData')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th>{tSettings('levelColClasses')}</Table.Th>
                  <Table.Th style={{ width: isSchoolAdminBranch ? 120 : 80 }}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {levels.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>{l.name}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {l.classes.length === 0 ? '-' : l.classes.map((c) => c.displayName).join(', ')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(l)} aria-label="Edit level" id={`level-list-edit-${l.id}`}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      {isSchoolAdminBranch && (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => void openDeleteLevel(l)}
                          aria-label={tSettings('academicDeleteAria')}
                          id={`level-list-delete-${l.id}`}
                          loading={deletionCheckLoadingId === l.id}
                          disabled={deletionCheckLoadingId !== null && deletionCheckLoadingId !== l.id}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      <Modal
        opened={blockerModal.opened}
        onClose={() => setBlockerModal({ opened: false, status: null })}
        title={tSettings('academicDeleteBlockedTitle')}
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">{tSettings('academicDeleteBlockedIntro')}</Text>
          {blockerModal.status?.blockers?.length ? (
            <List size="sm" spacing="xs">
              {blockerModal.status.blockers.map((b) => (
                <List.Item key={b.type}>{blockerLabel(b.type, b.count)}</List.Item>
              ))}
            </List>
          ) : null}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setBlockerModal({ opened: false, status: null })}>
              {tCommon('close')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={opened}
        onClose={handleClose}
        title={editLevel ? tSettings('levelModalEdit') : tSettings('levelModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput
              id="level-form-name"
              label={tSettings('levelFormNameLabel')}
              placeholder={tSettings('levelFormNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            {!editLevel && (
              <MultiSelect
                id="level-form-classes"
                label={tSettings('levelClassesLabel')}
                placeholder={tSettings('levelClassesPlaceholder')}
                data={classOptions}
                searchable
                {...form.getInputProps('classIds')}
              />
            )}
            <Group justify="flex-end" mt="md">
              <Button id="level-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="level-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
