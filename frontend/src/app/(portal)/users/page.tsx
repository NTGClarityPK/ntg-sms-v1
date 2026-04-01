'use client';

import { Badge, Group, Title, Skeleton, Stack, Alert, Text, Button, TextInput, MultiSelect, Paper, Chip, Tooltip, ActionIcon } from '@mantine/core';
import { IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useDisclosure, useDebouncedValue } from '@mantine/hooks';
import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { UserTable } from '@/components/features/users/UserTable';
import { UserForm } from '@/components/features/users/UserForm';
import { useUsers } from '@/hooks/useUsers';
import { useRoles } from '@/hooks/useRoles';
import { usePermissions, useFeaturePermission } from '@/hooks/usePermissions';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { User } from '@/types/users';

const PAGE_SIZE = 20;
const FETCH_LIMIT = 500; // Fetch all branch users once; filter All/Active/Inactive on frontend

export default function UsersPage() {
  const t = useTranslations('user');
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const { isLoading: permissionsLoading } = usePermissions();
  const { canEdit } = useFeaturePermission('user_management');
  const [opened, { open, close }] = useDisclosure(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Single fetch: all users for branch; filter (All/Active/Inactive, role, search) and sort/paginate client-side
  const usersQuery = useUsers({ limit: FETCH_LIMIT });

  const allUsers: User[] = useMemo(() => {
    const raw = usersQuery.data?.data;
    if (!Array.isArray(raw)) return [];
    return raw as User[];
  }, [usersQuery.data?.data]);

  const filteredUsers = useMemo(() => {
    let list = allUsers;
    if (statusFilter !== undefined) {
      list = list.filter((u) => u.isActive === statusFilter);
    }
    if (roleFilter.length > 0) {
      list = list.filter((u) =>
        u.roles?.some((r) => roleFilter.includes(r.roleId)),
      );
    }
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term),
      );
    }
    return list;
  }, [allUsers, statusFilter, roleFilter, debouncedSearch]);

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    const key: keyof User =
      sortBy === 'fullName'
        ? 'fullName'
        : sortBy === 'email'
          ? 'email'
          : sortBy === 'isActive'
            ? 'isActive'
            : sortBy === 'created_at' || sortBy === 'createdAt'
              ? 'createdAt'
              : 'createdAt';
    const order = sortOrder === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal === bVal) return 0;
      if (aVal == null) return order;
      if (bVal == null) return -order;
      const cmp =
        typeof aVal === 'string' && typeof bVal === 'string'
          ? aVal.localeCompare(bVal, undefined, { numeric: key === 'createdAt' })
          : String(aVal).localeCompare(String(bVal));
      return cmp * order;
    });
    return sorted;
  }, [filteredUsers, sortBy, sortOrder]);

  const totalFiltered = sortedUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const paginatedUsers = useMemo(
    () => sortedUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedUsers, page],
  );

  const hasActiveFilter = statusFilter !== undefined || roleFilter.length > 0 || !!debouncedSearch;
  const totalUsers = allUsers.length;

  const { data: rolesData } = useRoles();
  const roles = rolesData?.data || [];
  const staffRoles = useMemo(
    () => roles.filter((role) => role.name !== 'student' && role.name !== 'super_admin'),
    [roles],
  );

  const handleFilterChange = () => setPage(1);

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <div>
            <Title order={1}>{t('title')}</Title>
          </div>
          <Group gap="sm">
            <Badge variant="light" color="gray" id="users-total-count">
              {hasActiveFilter
                ? t('showingFilteredUsers', { filtered: totalFiltered, total: totalUsers })
                : t('totalUsers', { count: totalUsers })}
            </Badge>
            <Tooltip label={t('refresh')}>
              <ActionIcon
                variant="light"
                size="lg"
                loading={usersQuery.isRefetching}
                onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            {canEdit && (
              <Button id="users-btn-create" leftSection={<IconPlus size={16} />} onClick={open}>
                {t('createUser')}
              </Button>
            )}
          </Group>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
        {!permissionsLoading && !canEdit && (
          <Alert color={colors.info} title={t('viewOnly')}>
            <Text size="sm">
              {t('viewOnlyMessage')}
            </Text>
          </Alert>
        )}

        <Group>
          <TextInput
            id="users-search"
            placeholder={t('searchPlaceholder')}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              handleFilterChange();
            }}
            style={{ flex: 1 }}
          />
          <div style={{ width: 200, flexShrink: 0 }}>
            <MultiSelect
              id="users-filter-role"
              placeholder={t('filterByRole')}
              data={staffRoles.map((r) => ({ value: r.id, label: r.displayName }))}
              value={roleFilter}
              onChange={(value) => {
                setRoleFilter(value);
                handleFilterChange();
              }}
              clearable
              searchable
              style={{ width: '100%' }}
            />
          </div>
        </Group>

        {/* Status filter chips (All, Active, Inactive) - same pattern as /notifications */}
        <Paper p="sm" withBorder>
          <Group gap="xs" wrap="wrap" className="filter-chip-group">
            <Chip
              checked={statusFilter === undefined}
              onChange={() => {
                setStatusFilter(undefined);
                handleFilterChange();
              }}
              variant="filled"
            >
              {t('all')}
            </Chip>
            <Chip.Group
              value={statusFilter === undefined ? '' : statusFilter ? 'active' : 'inactive'}
              onChange={(value) => {
                const val = Array.isArray(value) ? value[0] : value;
                if (val === 'active') setStatusFilter(true);
                else if (val === 'inactive') setStatusFilter(false);
                else setStatusFilter(undefined);
                handleFilterChange();
              }}
            >
              <Group gap="xs" wrap="wrap">
                <Chip value="active" variant="filled">
                  {t('active')}
                </Chip>
                <Chip value="inactive" variant="filled">
                  {t('inactive')}
                </Chip>
              </Group>
            </Chip.Group>
          </Group>
        </Paper>

        {usersQuery.isLoading || usersQuery.isRefetching || !usersQuery.data ? (
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
            <Skeleton height={50} />
          </Stack>
        ) : usersQuery.error ? (
          <Alert color={colors.error} title={t('failedToLoad')}>
            <Group justify="space-between" mt="sm">
              <Text size="sm">{t('pleaseTryAgain')}</Text>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => usersQuery.refetch()}
              >
                {t('retry')}
              </Button>
            </Group>
          </Alert>
        ) : paginatedUsers.length === 0 && !usersQuery.isLoading ? (
          <Alert color={colors.info} title={hasActiveFilter ? t('noUsersMatchFilter') : t('noUsersFound')}>
            <Text size="sm">
              {hasActiveFilter
                ? statusFilter === false
                  ? t('noUsersFilterHintInactive')
                  : t('noUsersFilterHint')
                : canEdit
                  ? t('noUsersHintCanEdit')
                  : t('noUsersHint')}
            </Text>
          </Alert>
        ) : (
          <UserTable
            users={paginatedUsers}
            meta={{
              total: totalFiltered,
              page,
              limit: PAGE_SIZE,
              totalPages,
            }}
            onPageChange={setPage}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={(field) => {
              if (sortBy === field) {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy(field);
                setSortOrder('asc');
              }
              setPage(1);
            }}
            canEdit={canEdit}
          />
        )}
        </Stack>
      </div>

      <UserForm opened={opened} onClose={close} roles={staffRoles} />
    </>
  );
}

