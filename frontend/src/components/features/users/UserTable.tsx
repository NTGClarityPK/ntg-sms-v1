'use client';

import { useState } from 'react';
import {
  Table,
  Badge,
  Group,
  ActionIcon,
  Tooltip,
  Pagination,
  Text,
  Modal,
  Stack,
  TextInput,
  Button,
  ScrollArea,
  useMantineTheme,
  CopyButton,
  Alert,
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
  const [sentInfo, setSentInfo] = useState<{
    recipientEmail: string;
    sentAt?: string;
    expiresAt?: string;
  } | null>(null);
  const { data: rolesData } = useRoles();
  const deleteUser = useDeleteUser();
  const resend = useResendInvitationForUser();
  const roles = rolesData?.data || [];
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const invitationTypeForUser = (u: User): 'student' | 'parent_account' | 'staff' => {
    const roleNames = (u.roles ?? []).map((r) => (r.roleName || '').trim().toLowerCase());
    const isParent = roleNames.some((n) => ['parent', 'guardian', 'father', 'mother'].includes(n));
    if (isParent) return 'parent_account';
    const isStudent = roleNames.some((n) => n === 'student');
    if (isStudent) return 'student';
    return 'staff';
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    open();
  };

  const openInvitationSentModal = (input: { recipientEmail: string; expiresAt?: string }) => {
    const recipient = input.recipientEmail?.trim();
    if (!recipient) return;

    modals.open({
      title: t('invitationDetailsTitle'),
      size: 'lg',
      centered: true,
      children: (
        <Stack gap="sm">
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Th w={180}>{t('invitationRecipientEmail')}</Table.Th>
                <Table.Td>
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm">{recipient}</Text>
                    <CopyButton value={recipient}>
                      {({ copy }) => (
                        <Button size="xs" variant="light" onClick={copy}>
                          {tCommon('copy')}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                </Table.Td>
              </Table.Tr>
              {input.expiresAt && (
                <Table.Tr>
                  <Table.Th>Expires at</Table.Th>
                  <Table.Td>
                    <Text size="sm">{new Date(input.expiresAt).toLocaleString()}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      ),
    });
  };

  const handleResend = (user: User) => {
    setResendUser(user);
    setRecipientEmail('');
    // Show the most recently used invite destination (if we have it) inside the resend modal.
    setSentInfo(
      user.invitationRecipientEmail
        ? { recipientEmail: user.invitationRecipientEmail, sentAt: user.invitationSentAt }
        : null,
    );
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
                  {(() => {
                    const status = user.accountStatus ?? (user.isActive ? 'active' : 'inactive');
                    if (status === 'pending_verification') {
                      return (
                        <Badge color="yellow" variant="light">
                          {t('pendingVerification')}
                        </Badge>
                      );
                    }
                    if (status === 'link_expired') {
                      return (
                        <Badge color="red" variant="light">
                          {t('linkExpired')}
                        </Badge>
                      );
                    }
                    if (status === 'inactive') {
                      return (
                        <Badge color="gray" variant="light">
                          {t('inactive')}
                        </Badge>
                      );
                    }
                    return (
                      <Badge color="green" variant="light">
                        {t('active')}
                      </Badge>
                    );
                  })()}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {canEdit && (
                      <>
                        {(() => {
                          const status = user.accountStatus ?? (user.isActive ? 'active' : 'inactive');
                          const canResend = status !== 'active';
                          return canResend ? (
                            <Tooltip label={t('resendInvitationTitle')} withArrow>
                              <ActionIcon
                                variant="light"
                                onClick={() => handleResend(user)}
                                aria-label={t('resendInvitationTitle')}
                                id={`users-resend-invite-${user.id}`}
                              >
                                <IconMailForward size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : null;
                        })()}
                        <Tooltip label={tCommon('edit')} withArrow>
                          <ActionIcon
                            id={`users-edit-${user.id}`}
                            variant="light"
                            onClick={() => handleEdit(user)}
                            aria-label={tCommon('edit')}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={t('deactivateUser')} withArrow>
                          <ActionIcon
                            id={`users-deactivate-${user.id}`}
                            variant="light"
                            color="red"
                            onClick={() => handleDelete(user)}
                            aria-label={t('deactivateUser')}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
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
          setSentInfo(null);
        }}
        title={t('resendInvitationTitle')}
      >
        <Stack gap="md">
          {sentInfo?.recipientEmail && (
            <Alert
              variant="light"
              title={t('invitationDetailsTitle')}
              styles={{
                root: {
                  borderColor: 'var(--theme-primary)',
                  backgroundColor: 'var(--theme-surface-variant)',
                },
                title: { color: 'var(--theme-text)' },
              }}
            >
              <Stack gap={6}>
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm">{sentInfo.recipientEmail}</Text>
                  <CopyButton value={sentInfo.recipientEmail}>
                    {({ copy }) => (
                      <Button size="xs" variant="light" onClick={copy}>
                        {tCommon('copy')}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
                {sentInfo.sentAt && (
                  <Text size="sm" c="dimmed">
                    {t('invitationSentAt', {
                      date: new Date(sentInfo.sentAt).toLocaleString(),
                    })}
                  </Text>
                )}
                {sentInfo.expiresAt && (
                  <Text size="sm" c="dimmed">
                    Expires at: {new Date(sentInfo.expiresAt).toLocaleString()}
                  </Text>
                )}
              </Stack>
            </Alert>
          )}
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
                const result = await resend.mutateAsync({
                  userId: resendUser.id,
                  invitationType: invitationTypeForUser(resendUser),
                  recipientEmail: recipientEmail.trim() || undefined,
                });
                const usedEmail =
                  recipientEmail.trim() ||
                  resendUser.invitationRecipientEmail ||
                  resendUser.email;
                setSentInfo({ recipientEmail: usedEmail, expiresAt: result.expiresAt });
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

