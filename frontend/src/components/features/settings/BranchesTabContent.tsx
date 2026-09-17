'use client';

import { useMemo } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { IconPlus, IconRefresh, IconBuildingCommunity } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { useAuth } from '@/hooks/useAuth';
import { useCreateBranch, useTenantBranches } from '@/hooks/useBranches';
import { useSubscriptionUsage } from '@/hooks/api/useSubscription';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';

type CreateBranchFormValues = {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
};

export function BranchesTabContent() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const { user } = useAuth();
  const [opened, { open, close }] = useDisclosure(false);

  const branchesQuery = useTenantBranches();
  const createMutation = useCreateBranch();
  const usageQuery = useSubscriptionUsage();

  const form = useForm<CreateBranchFormValues>({
    initialValues: {
      name: '',
      code: '',
      address: '',
      phone: '',
      email: '',
    },
    validate: {
      name: (value) => (value.trim().length < 2 ? t('branchesNameRequired') : null),
      email: (value) => {
        const v = value.trim();
        if (!v) return null;
        return /^\S+@\S+\.\S+$/.test(v) ? null : t('branchesEmailInvalid');
      },
    },
  });

  const branches = branchesQuery.data?.data ?? [];
  const currentBranchId = user?.currentBranch?.id;

  const branchLimit = usageQuery.data?.limits.branches ?? -1;
  const branchesUsed = usageQuery.data?.usage.branchesUsed ?? branches.length;
  const atBranchLimit = branchLimit !== -1 && branchesUsed >= branchLimit;

  const sortedBranches = useMemo(
    () =>
      [...branches].sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
      ),
    [branches],
  );

  const handleClose = () => {
    close();
    form.reset();
  };

  const onSubmit = form.onSubmit(async (values) => {
    try {
      await createMutation.mutateAsync({
        name: values.name.trim(),
        code: values.code.trim() || undefined,
        address: values.address.trim() || undefined,
        phone: values.phone.trim() || undefined,
        email: values.email.trim() || undefined,
      });
      notifications.show({
        id: 'branch-created',
        title: tCommon('success'),
        message: t('branchesCreateSuccess'),
        color: notifyColors.success,
      });
      handleClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('branchesCreateError');
      notifications.show({
        id: 'branch-create-error',
        title: tCommon('error'),
        message,
        color: notifyColors.error,
      });
    }
  });

  if (branchesQuery.isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={28} width="40%" />
        <Skeleton height={40} width={160} />
        <Skeleton height={220} />
      </Stack>
    );
  }

  if (branchesQuery.error) {
    return (
      <Alert color={colors.error} title={t('branchesLoadError')}>
        <Group justify="space-between" mt="sm">
          <Text size="sm">{t('genericPleaseTryAgain')}</Text>
          <Button
            id="settings-branches-retry"
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void branchesQuery.refetch();
            }}
          >
            {tCommon('retry')}
          </Button>
        </Group>
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <IconBuildingCommunity size={20} color={colors.primary} />
            <Text fw={600} size="lg">
              {t('branchesTitle')}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {t('branchesDescription')}
          </Text>
        </Stack>

        <Tooltip
          label={t('branchesLimitReached')}
          disabled={!atBranchLimit}
          withArrow
        >
          <Button
            id="settings-branches-add"
            leftSection={<IconPlus size={16} />}
            onClick={open}
            disabled={atBranchLimit}
          >
            {t('branchesAddButton')}
          </Button>
        </Tooltip>
      </Group>

      {atBranchLimit && (
        <Alert color="orange" variant="light">
          {t('branchesLimitReached')}
        </Alert>
      )}

      <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }}>
        {sortedBranches.length === 0 ? (
          <Stack align="center" gap="sm" py="xl" px="md">
            <Text c="dimmed" size="sm">
              {t('branchesEmpty')}
            </Text>
            <Button
              id="settings-branches-empty-add"
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={open}
              disabled={atBranchLimit}
            >
              {t('branchesAddButton')}
            </Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table striped highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('branchesColName')}</Table.Th>
                  <Table.Th>{t('branchesColCode')}</Table.Th>
                  <Table.Th>{t('branchesColAddress')}</Table.Th>
                  <Table.Th>{t('branchesColPhone')}</Table.Th>
                  <Table.Th>{t('branchesColEmail')}</Table.Th>
                  <Table.Th>{t('branchesColStatus')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedBranches.map((branch) => {
                  const isCurrent = branch.id === currentBranchId;
                  return (
                    <Table.Tr key={branch.id}>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" fw={500}>
                            {branch.name}
                          </Text>
                          {isCurrent && (
                            <Badge size="sm" variant="light" color="teal">
                              {t('branchesCurrentBadge')}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {branch.code || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {branch.address || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{branch.phone || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{branch.email || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={branch.isActive !== false ? 'teal' : 'gray'}
                        >
                          {branch.isActive !== false
                            ? t('branchesStatusActive')
                            : t('branchesStatusInactive')}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal
        id="settings-branches-add-modal"
        opened={opened}
        onClose={handleClose}
        title={t('branchesAddModalTitle')}
        centered
        size="md"
      >
        <form onSubmit={onSubmit}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t('branchesAddModalHint')}
            </Text>
            <TextInput
              id="settings-branch-name"
              label={t('branchNameLabel')}
              placeholder={t('branchNamePlaceholder')}
              required
              {...form.getInputProps('name')}
            />
            <TextInput
              id="settings-branch-code"
              label={t('branchCodeLabel')}
              placeholder={t('branchesCodePlaceholder')}
              description={t('branchesCodeHint')}
              {...form.getInputProps('code')}
            />
            <TextInput
              id="settings-branch-address"
              label={t('branchAddressLabel')}
              placeholder={t('branchAddressPlaceholder')}
              {...form.getInputProps('address')}
            />
            <Group grow>
              <TextInput
                id="settings-branch-phone"
                label={t('branchPhoneLabel')}
                placeholder={t('branchPhonePlaceholder')}
                {...form.getInputProps('phone')}
              />
              <TextInput
                id="settings-branch-email"
                label={t('branchEmailLabel')}
                placeholder={t('branchEmailPlaceholder')}
                {...form.getInputProps('email')}
              />
            </Group>
            <Group justify="flex-end" mt="sm">
              <Button
                id="settings-branch-cancel"
                type="button"
                variant="default"
                onClick={handleClose}
                disabled={createMutation.isPending}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                id="settings-branch-submit"
                type="submit"
                loading={!atBranchLimit && createMutation.isPending}
                disabled={atBranchLimit}
              >
                {t('branchesCreateSubmit')}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
