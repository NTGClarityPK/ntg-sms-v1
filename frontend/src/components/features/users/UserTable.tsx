'use client';

import { useState } from 'react';
import { Table, Badge, Group, ActionIcon, Pagination, Text } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
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
}

export function UserTable({ users, meta, onPageChange }: UserTableProps) {
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
      title: 'Deactivate User',
      children: (
        <Text size="sm">
          Are you sure you want to deactivate {user.fullName}? This will prevent them from logging in.
        </Text>
      ),
      labels: { confirm: 'Deactivate', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        deleteUser.mutate(user.id);
      },
    });
  };

  const getRoleBadges = (userRoles?: User['roles']) => {
    if (!userRoles || userRoles.length === 0) return <Text c="dimmed" size="sm">No roles</Text>;
    
    const roleMap = new Map(roles.map((r) => [r.id, r.displayName]));
    return (
      <Group gap="xs">
        {userRoles.map((ur) => (
          <Badge key={ur.roleId} size="sm" variant="light">
            {roleMap.get(ur.roleId) || ur.roleName}
          </Badge>
        ))}
      </Group>
    );
  };

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Roles</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
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
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="light" onClick={() => handleEdit(user)}>
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon variant="light" color="red" onClick={() => handleDelete(user)}>
                    <IconTrash size={16} />
                  </ActionIcon>
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

