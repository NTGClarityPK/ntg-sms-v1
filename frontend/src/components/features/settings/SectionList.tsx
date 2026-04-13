'use client';

import { Alert, ActionIcon, Button, Group, List, Skeleton, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconPencil, IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { fetchSectionDeletionStatus, useCreateSection, useDeleteSection, useSections, useUpdateSection } from '@/hooks/useCoreLookups';
import { useIsSchoolAdminForCurrentBranch } from '@/hooks/useSchoolAdminBranch';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { useState } from 'react';
import type { AcademicEntityDeletionStatus, Section } from '@/types/settings';
import { useTranslations } from 'next-intl';

export function SectionList() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tBlockers = useTranslations('settings.academicDeleteBlockers');
  const [opened, { open, close }] = useDisclosure(false);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const isSchoolAdminBranch = useIsSchoolAdminForCurrentBranch();
  const listQuery = useSections();
  const createMutation = useCreateSection();
  const updateMutation = useUpdateSection();
  const deleteMutation = useDeleteSection();
  const [blockerModal, setBlockerModal] = useState<{ opened: boolean; status: AcademicEntityDeletionStatus | null }>({
    opened: false,
    status: null,
  });
  const [deletionCheckLoadingId, setDeletionCheckLoadingId] = useState<string | null>(null);

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

  const openDeleteSection = async (s: Section) => {
    setDeletionCheckLoadingId(s.id);
    try {
      const status = await fetchSectionDeletionStatus(s.id);
      if (status.canDelete) {
        modals.openConfirmModal({
          title: tSettings('academicDeleteConfirmAction'),
          children: <Text size="sm">{tSettings('academicDeleteConfirmSection', { name: s.name })}</Text>,
          labels: { confirm: tSettings('academicDeleteConfirmAction'), cancel: tCommon('cancel') },
          confirmProps: { color: 'red' },
          onConfirm: async () => {
            try {
              await deleteMutation.mutateAsync(s.id);
              notifications.show({
                title: tCommon('success'),
                message: tSettings('sectionDeleted'),
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

  const form = useForm<{ name: string }>({
    initialValues: { name: '' },
    validate: {
      name: (v) => (v.trim().length === 0 ? tSettings('sectionNameRequired') : null),
    },
    transformValues: (v) => ({ name: v.name.trim() }),
  });

  const openCreate = () => {
    setEditSection(null);
    form.setValues({ name: '' });
    open();
  };

  const openEdit = (s: Section) => {
    setEditSection(s);
    form.setValues({ name: s.name });
    open();
  };

  const handleClose = () => {
    close();
    setEditSection(null);
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      if (editSection) {
        await updateMutation.mutateAsync({ id: editSection.id, payload: { name: values.name } });
        notifications.show({ title: tCommon('success'), message: tSettings('sectionUpdated'), color: notifyColors.success });
      } else {
        await createMutation.mutateAsync(values);
        notifications.show({ title: tCommon('success'), message: tSettings('sectionCreated'), color: notifyColors.success });
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
      <Alert color={colors.error} title={tSettings('sectionLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
          <Button id="section-list-retry" variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  const sections = listQuery.data?.data ?? [];

  return (
    <>
      <Group justify="flex-end" mb="md">
        <Button id="section-list-add" leftSection={<IconPlus size={16} />} onClick={openCreate}>
          {tSettings('sectionAddButton')}
        </Button>
      </Group>

      <Paper withBorder p="md">
        {sections.length === 0 ? (
          <Text c="dimmed" size="sm">
            {tSettings('sectionNoData')}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommon('name')}</Table.Th>
                <Table.Th style={{ width: isSchoolAdminBranch ? 120 : 80 }}>{tCommon('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sections.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>{s.name}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <ActionIcon variant="subtle" size="sm" onClick={() => openEdit(s)} aria-label="Edit section" id={`section-list-edit-${s.id}`}>
                        <IconPencil size={16} />
                      </ActionIcon>
                      {isSchoolAdminBranch && (
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          color="red"
                          onClick={() => void openDeleteSection(s)}
                          aria-label={tSettings('academicDeleteAria')}
                          id={`section-list-delete-${s.id}`}
                          loading={deletionCheckLoadingId === s.id}
                          disabled={deletionCheckLoadingId !== null && deletionCheckLoadingId !== s.id}
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
        title={editSection ? tSettings('sectionModalEdit') : tSettings('sectionModalAdd')}
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <TextInput
              id="section-form-name"
              label={tSettings('sectionFormNameLabel')}
              placeholder={tSettings('sectionFormNamePlaceholder')}
              {...form.getInputProps('name')}
            />
            <Group justify="flex-end" mt="md">
              <Button id="section-form-cancel" variant="light" onClick={handleClose} disabled={createMutation.isPending || updateMutation.isPending}>
                {tCommon('cancel')}
              </Button>
              <Button id="section-form-submit" type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                {tCommon('save')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </>
  );
}
