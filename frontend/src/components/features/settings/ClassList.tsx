'use client';

import { Alert, ActionIcon, Button, Group, List, Skeleton, Modal, NumberInput, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { fetchClassDeletionStatus, useClasses, useCreateClass, useDeleteClass, useUpdateClass } from '@/hooks/useCoreLookups';
import { useIsSchoolAdminForCurrentBranch } from '@/hooks/useSchoolAdminBranch';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { AcademicEntityDeletionStatus, ClassEntity } from '@/types/settings';
import { useTranslations } from 'next-intl';

export function ClassList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tBlockers = useTranslations('settings.academicDeleteBlockers');
  const [opened, { open, close }] = useDisclosure(false);
  const [editClass, setEditClass] = useState<ClassEntity | null>(null);
  const isSchoolAdminBranch = useIsSchoolAdminForCurrentBranch();
  const listQuery = useClasses();
  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass();
  const [blockerModal, setBlockerModal] = useState<{ opened: boolean; status: AcademicEntityDeletionStatus | null }>({
    opened: false,
    status: null,
  });
  const [deletionCheckLoadingId, setDeletionCheckLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const knownBlockerTypes = new Set([
    'subject_template_subjects',
    'teacher_assignments',
    'assessments',
    'timetable_slots',
    'library_items',
    'class_sections',
    'level_classes',
    'class_subject_template_assignments',
    'class_grade_assignments',
    'class_timing_assignments',
    'students',
    'student_enrolments',
    'student_promotion_decisions',
  ]);

  const blockerLabel = (type: string, count: number): string => {
    if (knownBlockerTypes.has(type)) {
      return tBlockers(type as 'assessments', { count });
    }
    return tSettings('academicDeleteBlockedUnknown', { type, count });
  };

  const openDeleteClass = async (c: ClassEntity) => {
    setDeletionCheckLoadingId(c.id);
    try {
      const status = await fetchClassDeletionStatus(c.id);
      if (status.canDelete) {
        modals.openConfirmModal({
          title: tSettings('academicDeleteConfirmAction'),
          children: <Text size="sm">{tSettings('academicDeleteConfirmClass', { name: c.displayName || c.name })}</Text>,
          labels: { confirm: tSettings('academicDeleteConfirmAction'), cancel: tCommon('cancel') },
          confirmProps: { color: 'red' },
          onConfirm: async () => {
            setDeletingId(c.id);
            try {
              await deleteMutation.mutateAsync(c.id);
              notifications.show({
                title: tCommon('success'),
                message: tSettings('classDeleted'),
                color: notifyColors.success,
              });
              await listQuery.refetch();
            } catch (error) {
              const message = error instanceof Error ? error.message : tCommon('errors.generic');
              notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
            } finally {
              setDeletingId(null);
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

  const form = useForm<{ name: string; displayName: string; sortOrder: number }>({
    initialValues: { name: '', displayName: '', sortOrder: 0 },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('classNameRequired') : null),
      displayName: (v) => (v.trim().length === 0 ? tSettings('classDisplayNameRequired') : null),
    },
    transformValues: (v) => ({ name: v.name.trim(), displayName: v.displayName.trim(), sortOrder: v.sortOrder }),
  });

  const openCreate = () => {
    setEditClass(null);
    form.setValues({ name: '', displayName: '', sortOrder: 0 });
    open();
  };

  const openEdit = (c: ClassEntity) => {
    setEditClass(c);
    form.setValues({ name: c.name, displayName: c.displayName, sortOrder: c.sortOrder });
    open();
  };

  const handleClose = () => {
    close();
    setEditClass(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      if (editClass) {
        await updateMutation.mutateAsync({
          id: editClass.id,
          payload: { name: values.name, displayName: values.displayName, sortOrder: values.sortOrder },
        });
        notifications.show({ title: tCommon('success'), message: tSettings('classUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: tCommon('success'), message: tSettings('classCreated'), color: notifyColors.success });
      }
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  });

  if (listQuery.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={50} />
      </Stack>
    );
  }

  if (listQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('classLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="class-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const classes = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button id="class-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('classAddButton')}
        </Button>
      </Group>

      <Paper withBorder p="md">
        {classes.length === 0 ? (
          <Text c="dimmed" size="sm">
            {tSettings('classNoData')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th>{tSettings('classColDisplayName')}</Table.Th>
                <Table.Th>{tSettings('classColSort')}</Table.Th>
                <Table.Th style={{ width: isSchoolAdminBranch ? 120 : 80 }}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {classes.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>{c.displayName}</Table.Td>
                  <Table.Td>{c.sortOrder}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(c)} aria-label="Edit class" id={`class-list-edit-${c.id}`}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      {isSchoolAdminBranch && (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => void openDeleteClass(c)}
                          aria-label={tSettings('academicDeleteAria')}
                          id={`class-list-delete-${c.id}`}
                          loading={deletionCheckLoadingId === c.id || deletingId === c.id}
                          disabled={
                            (deletionCheckLoadingId !== null && deletionCheckLoadingId !== c.id) ||
                            (deletingId !== null && deletingId !== c.id)
                          }
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
        title={editClass ? tSettings('classModalEdit') : tSettings('classModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput
              id="class-form-name"
              label={tSettings('classFormNameLabel')}
              placeholder={tSettings('classFormNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            <TextInput
              id="class-form-display-name"
              label={tSettings('classDisplayNameLabel')}
              placeholder={tSettings('classDisplayNamePlaceholder')}
              {...form.getInputProps('displayName')}
            />
            <NumberInput
              id="class-form-sort-order"
              label={tSettings('classSortOrderLabel')}
              placeholder={tSettings('classSortOrderPlaceholder')}
              min={0}
              {...form.getInputProps('sortOrder')}
            />
            <Group justify="flex-end" mt="md">
              <Button id="class-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="class-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
