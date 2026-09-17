'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconUsersGroup } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { User } from '@/types/auth';
import type { ParentLinkedChild } from '@/types/parent-children';

function relationshipLabel(
  t: ReturnType<typeof useTranslations<'myChildren'>>,
  relationship: ParentLinkedChild['relationship'],
): string {
  if (relationship === 'father') return t('relationshipFather');
  if (relationship === 'mother') return t('relationshipMother');
  return t('relationshipGuardian');
}

function statusBadge(
  t: ReturnType<typeof useTranslations<'myChildren'>>,
  child: ParentLinkedChild,
): { label: string; color: string } {
  if (child.isActive === false) {
    return { label: t('statusInactive'), color: 'gray' };
  }
  if (child.accountStatus === 'pending_verification') {
    return { label: t('statusPending'), color: 'yellow' };
  }
  if (child.accountStatus === 'link_expired') {
    return { label: t('statusLinkExpired'), color: 'orange' };
  }
  if (child.isActive === true || child.accountStatus === 'active') {
    return { label: t('statusActive'), color: 'green' };
  }
  return { label: t('statusActive'), color: 'green' };
}

export default function MyChildrenPage() {
  const t = useTranslations('myChildren');
  const colors = useThemeColors();
  const { user } = useAuth();
  const userId = (user as User | undefined)?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-children', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.get<ParentLinkedChild[]>(
        `/api/v1/parents/${userId}/children`,
      );
      return response.data || [];
    },
    enabled: !!userId,
  });

  const children = Array.isArray(data) ? data : [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="xs">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={1}>
            {t('title')}
          </Title>
        </Group>
      </div>

      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('subtitle')}
          </Text>

          {isLoading || !data ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Skeleton height={140} radius="sm" />
              <Skeleton height={140} radius="sm" />
            </SimpleGrid>
          ) : error ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color={colors.error}
              title={t('loadErrorTitle')}
            >
              <Group justify="space-between" mt="sm">
                <Text size="sm">{t('loadErrorBody')}</Text>
                <Text
                  id="my-children-retry"
                  size="sm"
                  c={colors.primary}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => refetch()}
                >
                  {t('retry')}
                </Text>
              </Group>
            </Alert>
          ) : children.length === 0 ? (
            <Alert icon={<IconUsersGroup size={16} />} color={colors.info} title={t('emptyTitle')}>
              <Text size="sm">{t('emptyBody')}</Text>
            </Alert>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {children.map((child) => {
                const status = statusBadge(t, child);
                return (
                  <Paper key={child.id} id={`my-child-card-${child.studentId}`} withBorder p="md">
                    <Stack gap="sm">
                      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                        <Text fw={600} size="lg" lineClamp={2}>
                          {child.studentName || t('unnamedStudent')}
                        </Text>
                        <Badge variant="light" color={status.color} style={{ flexShrink: 0 }}>
                          {status.label}
                        </Badge>
                      </Group>

                      <Stack gap={4}>
                        <Text size="sm" c="dimmed">
                          {t('studentIdLabel')}: {child.studentStudentId || child.studentId}
                        </Text>
                        {child.classSectionLabel ? (
                          <Text size="sm" c="dimmed">
                            {t('classLabel')}: {child.classSectionLabel}
                          </Text>
                        ) : null}
                        <Text size="sm" c="dimmed">
                          {t('relationshipLabel')}: {relationshipLabel(t, child.relationship)}
                          {child.isPrimary ? ` · ${t('primaryContact')}` : ''}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {child.canApprove ? t('canApproveHint') : t('cannotApproveHint')}
                        </Text>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          )}
        </Stack>
      </div>
    </>
  );
}
