'use client';

import { useState } from 'react';
import {
  Table,
  Badge,
  Group,
  ActionIcon,
  Pagination,
  Text,
  Modal,
  Stack,
  TextInput,
  Button,
  ScrollArea,
  useMantineTheme,
} from '@mantine/core';
import { IconEdit, IconTrash, IconChevronUp, IconChevronDown, IconMailForward } from '@tabler/icons-react';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { useTranslations } from 'next-intl';
import type { User } from '@/types/users';
import { UserForm } from './UserForm';
import { useRoles } from '@/hooks/useRoles';
import { useDeleteUser } from '@/hooks/useUsers';
import { useResendInvitationForUser } from '@/hooks/useInvitationsAdmin';

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
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('user');
  const tCommon = useTranslations('common');
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resendOpened, resendModal] = useDisclosure(false);
  const [resendUser, setResendUser] = useState<User | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const { data: rolesData } = useRoles();
  const deleteUser = useDeleteUser();
  const resend = useResendInvitationForUser();
  const roles = rolesData?.data || [];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    open();
  };

  const handleResend = (user: User) => {
    setResendUser(user);
    setRecipientEmail('');
    resendModal.open();
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
      <ScrollArea type="auto" scrollbars="x" w="100%">
        <Table striped highlightOnHover style={{ minWidth: 800 }}>
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
                        <ActionIcon
                          variant="light"
                          onClick={() => handleResend(user)}
                          aria-label="Resend invitation"
                          id={`users-resend-invite-${user.id}`}
                        >
                          <IconMailForward size={16} />
                        </ActionIcon>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {meta && meta.totalPages > 1 && (
        <ScrollArea type="auto" scrollbars="x" w="100%" mt="md">
          <Group justify="center" wrap="nowrap" gap={4} style={{ minWidth: 'min-content' }}>
            <Pagination
              total={meta.totalPages}
              value={meta.page}
              onChange={onPageChange}
              size={isMobile ? 'sm' : 'md'}
              withEdges={!isMobile}
            />
          </Group>
        </ScrollArea>
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

      <Modal
        opened={resendOpened}
        onClose={() => {
          resendModal.close();
          setResendUser(null);
          setRecipientEmail('');
        }}
        title={t('resendInvitationTitle')}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('resendInvitationIntro', {
              name: resendUser?.fullName || resendUser?.email || '—',
            })}
          </Text>

          <TextInput
            id="users-resend-recipient-email"
            label={t('sendToOptional')}
            placeholder={resendUser?.email || t('emailPlaceholder')}
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                resendModal.close();
                setResendUser(null);
                setRecipientEmail('');
              }}
            >
              {t('cancel')}
            </Button>
            <Button
              id="users-resend-submit"
              loading={resend.isPending}
              disabled={!resendUser}
              onClick={async () => {
                if (!resendUser) return;
                await resend.mutateAsync({
                  userId: resendUser.id,
                  invitationType: 'student',
                  recipientEmail: recipientEmail.trim() || undefined,
                });
                resendModal.close();
                setResendUser(null);
                setRecipientEmail('');
              }}
            >
              {t('resend')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

