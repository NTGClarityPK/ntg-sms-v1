'use client';

import { useState } from 'react';
import { Table, Badge, Group, ActionIcon, Pagination, Text, Modal, Stack, Tooltip, Button } from '@mantine/core';
import { IconTrash, IconEdit, IconUser } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useDisclosure } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import type { ParentAssociation } from '@/hooks/useParentAssociations';
import { useDeleteParentAssociation } from '@/hooks/useParentAssociations';
import { EditParentAssociationModal } from './EditParentAssociationModal';

interface ParentAssociationTableProps {
  associations: ParentAssociation[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
}

export function ParentAssociationTable({
  associations,
  meta,
  onPageChange,
}: ParentAssociationTableProps) {
  const t = useTranslations('user');
  const tCommon = useTranslations('common');
  const deleteAssociation = useDeleteParentAssociation();
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedAssociation, setSelectedAssociation] = useState<ParentAssociation | null>(null);
  const [parentInfoOpened, parentInfoModal] = useDisclosure(false);
  const [selectedParentRow, setSelectedParentRow] = useState<ParentAssociation | null>(null);

  const handleEdit = (association: ParentAssociation) => {
    setSelectedAssociation(association);
    open();
  };

  const handleDelete = (association: ParentAssociation) => {
    modals.openConfirmModal({
      title: t('removeAssociation'),
      children: (
        <Text size="sm">
          {t('removeAssociationConfirm', {
            parentName: association.parentName ?? '',
            studentName: association.studentName ?? '',
            studentStudentId: association.studentStudentId ?? '',
          })}
        </Text>
      ),
      labels: { confirm: t('remove'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteAssociation.mutate({
          parentUserId: association.parentUserId,
          studentId: association.studentId,
        });
      },
    });
  };

  const getRelationshipBadge = (relationship: string) => {
    const colors: Record<string, string> = {
      father: 'blue',
      mother: 'pink',
      guardian: 'gray',
    };
    const label = relationship === 'father' ? t('father') : relationship === 'mother' ? t('mother') : t('guardian');
    return (
      <Badge size="sm" variant="light" color={colors[relationship] || 'gray'}>
        {label}
      </Badge>
    );
  };

  return (
    <>
      <Table.ScrollContainer minWidth={800}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('parentName')}</Table.Th>
              <Table.Th>{t('studentName')}</Table.Th>
              <Table.Th>{t('studentId')}</Table.Th>
              <Table.Th>{t('relationship')}</Table.Th>
              <Table.Th>{t('priority')}</Table.Th>
              <Table.Th>{t('phone')}</Table.Th>
              <Table.Th>{t('canApprove')}</Table.Th>
              <Table.Th style={{ width: 100 }}>{t('actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {associations.map((association) => (
              <Table.Tr key={association.id}>
                <Table.Td>
                  <Group gap={6} wrap="nowrap">
                    <Text fw={500}>{association.parentName || 'N/A'}</Text>
                    <Tooltip label={t('viewParentDetails')} withArrow>
                      <ActionIcon
                        id={`parent-association-parent-info-${association.id}`}
                        variant="subtle"
                        size="sm"
                        onClick={() => {
                          setSelectedParentRow(association);
                          parentInfoModal.open();
                        }}
                        aria-label={t('viewParentDetails')}
                      >
                        <IconUser size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text>{association.studentName || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text c="dimmed" size="sm">
                    {association.studentStudentId || 'N/A'}
                  </Text>
                </Table.Td>
                <Table.Td>{getRelationshipBadge(association.relationship)}</Table.Td>
                <Table.Td>
                  {association.priority ? (
                    <Badge
                      size="sm"
                      variant="light"
                      color={association.priority === 1 ? 'green' : 'blue'}
                    >
                      {association.priority === 1 ? t('primary') : t('secondary')}
                    </Badge>
                  ) : (
                    <Text c="dimmed" size="sm">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{association.parentPhone || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  {association.canApprove ? (
                    <Badge size="sm" variant="light" color="green">
                      {t('yes')}
                    </Badge>
                  ) : (
                    <Badge size="sm" variant="light" color="red">
                      {t('no')}
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
                    <ActionIcon
                      variant="light"
                      onClick={() => handleEdit(association)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      color="red"
                      variant="light"
                      onClick={() => handleDelete(association)}
                      loading={deleteAssociation.isPending}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {meta && meta.totalPages > 1 && (
        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">
            {t('showingXtoYofZ', {
              from: ((meta.page - 1) * meta.limit) + 1,
              to: Math.min(meta.page * meta.limit, meta.total),
              total: meta.total,
            })}
          </Text>
          <Pagination
            value={meta.page}
            onChange={onPageChange}
            total={meta.totalPages}
            size="sm"
          />
        </Group>
      )}

      <EditParentAssociationModal
        opened={opened}
        onClose={() => {
          close();
          setSelectedAssociation(null);
        }}
        association={selectedAssociation}
      />

      <Modal
        opened={parentInfoOpened}
        onClose={() => {
          parentInfoModal.close();
          setSelectedParentRow(null);
        }}
        title={t('parentDetailsTitle')}
        size="md"
        centered
      >
        <Stack gap="sm">
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Th w={160}>{t('parentName')}</Table.Th>
                <Table.Td>{selectedParentRow?.parentName || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>{t('email')}</Table.Th>
                <Table.Td>{selectedParentRow?.parentEmail || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>{t('phone')}</Table.Th>
                <Table.Td>{selectedParentRow?.parentPhone || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>{t('relationship')}</Table.Th>
                <Table.Td>{selectedParentRow?.relationship || '—'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>{t('priority')}</Table.Th>
                <Table.Td>
                  {selectedParentRow?.priority === 1
                    ? t('primary')
                    : selectedParentRow?.priority === 2
                      ? t('secondary')
                      : '—'}
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          <Group justify="flex-end">
            <Button id="parent-association-parent-info-close" variant="light" onClick={parentInfoModal.close}>
              {tCommon('close')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

