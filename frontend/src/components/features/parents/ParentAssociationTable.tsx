'use client';

import { Table, Badge, Group, ActionIcon, Pagination, Text } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import type { ParentAssociation } from '@/hooks/useParentAssociations';
import { useDeleteParentAssociation } from '@/hooks/useParentAssociations';

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
  const deleteAssociation = useDeleteParentAssociation();

  const handleDelete = (association: ParentAssociation) => {
    modals.openConfirmModal({
      title: 'Remove Association',
      children: (
        <Text size="sm">
          Are you sure you want to remove the association between{' '}
          <strong>{association.parentName}</strong> and{' '}
          <strong>{association.studentName}</strong> ({association.studentStudentId})?
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
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
    return (
      <Badge size="sm" variant="light" color={colors[relationship] || 'gray'}>
        {relationship.charAt(0).toUpperCase() + relationship.slice(1)}
      </Badge>
    );
  };

  return (
    <>
      <Table.ScrollContainer minWidth={800}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Parent Name</Table.Th>
              <Table.Th>Student Name</Table.Th>
              <Table.Th>Student ID</Table.Th>
              <Table.Th>Relationship</Table.Th>
              <Table.Th>Primary</Table.Th>
              <Table.Th>Can Approve</Table.Th>
              <Table.Th style={{ width: 100 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {associations.map((association) => (
              <Table.Tr key={association.id}>
                <Table.Td>
                  <Text fw={500}>{association.parentName || 'N/A'}</Text>
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
                  {association.isPrimary ? (
                    <Badge size="sm" variant="light" color="green">
                      Yes
                    </Badge>
                  ) : (
                    <Text c="dimmed" size="sm">
                      No
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {association.canApprove ? (
                    <Badge size="sm" variant="light" color="green">
                      Yes
                    </Badge>
                  ) : (
                    <Badge size="sm" variant="light" color="red">
                      No
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end">
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
            Showing {((meta.page - 1) * meta.limit) + 1} to{' '}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} associations
          </Text>
          <Pagination
            value={meta.page}
            onChange={onPageChange}
            total={meta.totalPages}
            size="sm"
          />
        </Group>
      )}
    </>
  );
}

