'use client';

import { useState } from 'react';
import { Table, Badge, Group, ActionIcon, Pagination, Text } from '@mantine/core';
import { IconEdit, IconTrash, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useTranslations } from 'next-intl';
import type { User } from '@/types/users';
import { UserForm } from './UserForm';
import { useRoles } from '@/hooks/useRoles';
import { useDeleteUser } from '@/hooks/useUsers';

interface UserTableProps {
  users: User[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  canEdit?: boolean;
}

export function UserTable({ users, meta, onPageChange, sortBy, sortOrder, onSort, canEdit = true }: UserTableProps) {
  const t = useTranslations('user');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { data: rolesData } = useRoles();
  const deleteUser = useDeleteUser();
  const roles = rolesData?.data || [];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    open();
  };

  const handleDelete = (user: User) => {
    modals.openConfirmModal({
      title: t('deactivateUser'),
      children: (
        <Text size="sm">
          {t('deactivateConfirm', { name: user.fullName ?? '' })}
        </Text>
      ),
      labels: { confirm: t('deactivate'), cancel: t('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteUser.mutate(user.id);
      },
    });
  };

  const getRoleBadges = (userRoles?: User['roles']) => {
    if (!userRoles || userRoles.length === 0) return <Text c="dimmed" size="sm">{t('noRoles')}</Text>;

    const roleObjMap = new Map(roles.map((r) => [r.id, r]));
    return (
      <Group gap="xs">
        {userRoles.map((ur) => {
          const roleObj = roleObjMap.get(ur.roleId);
          const label = roleObj
            ? (tCommon(`roleName.${roleObj.name}` as any) || roleObj.displayName)
            : ur.roleName;
          return (
            <Badge key={ur.roleId} size="sm" variant="light">
              {label}
            </Badge>
          );
        })}
      </Group>
    );
  };

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => {
    const isSorted = sortBy === field;
    const isAsc = isSorted && sortOrder === 'asc';
    
    return (
      <Table.Th
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => onSort?.(field)}
      >
        <Group gap="xs" wrap="nowrap">
          <Text fw={500}>{children}</Text>
          {isSorted && (
            isAsc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
          )}
        </Group>
      </Table.Th>
    );
  };

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <SortableHeader field="fullName">{t('name')}</SortableHeader>
            <SortableHeader field="email">{t('email')}</SortableHeader>
            <Table.Th>{t('roles')}</Table.Th>
            <SortableHeader field="isActive">{t('status')}</SortableHeader>
            <Table.Th>{t('actions')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>
                <Text fw={500}>{user.fullName}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{user.email}</Text>
              </Table.Td>
              <Table.Td>{getRoleBadges(user.roles)}</Table.Td>
              <Table.Td>
                <Badge color={user.isActive ? 'green' : 'red'} variant="light">
                  {user.isActive ? t('active') : t('inactive')}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {canEdit && (
                    <>
                      <ActionIcon variant="light" onClick={() => handleEdit(user)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="light" color="red" onClick={() => handleDelete(user)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {meta && meta.totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={meta.totalPages}
            value={meta.page}
            onChange={onPageChange}
          />
        </Group>
      )}

      <UserForm
        opened={opened}
        onClose={() => {
          close();
          setSelectedUser(null);
        }}
        user={selectedUser}
        roles={roles}
      />
    </>
  );
}

