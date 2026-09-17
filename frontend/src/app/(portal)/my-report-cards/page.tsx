'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Group,
  Paper,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconMedal } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { ChildResultCards } from '@/components/features/results/ChildResultCards';
import type { User } from '@/types/auth';
import type { ParentLinkedChild } from '@/types/parent-children';

function initials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export default function MyReportCardsPage() {
  const t = useTranslations('myReportCards');
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

  const children = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (children.length === 0) {
      setSelectedStudentId(null);
      return;
    }
    setSelectedStudentId((prev) => {
      if (prev && children.some((c) => c.studentId === prev)) return prev;
      return children[0].studentId;
    });
  }, [children]);

  const selectedChild =
    children.find((c) => c.studentId === selectedStudentId) ?? children[0] ?? null;

  const childOptions = children.map((c) => ({
    value: c.studentId,
    label: c.studentName || t('unnamedStudent'),
  }));

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
          {isLoading || !data ? (
            <Stack gap="md">
              <Skeleton height={48} radius="sm" />
              <Skeleton height={220} radius="sm" />
            </Stack>
          ) : error ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color={colors.error}
              title={t('loadErrorTitle')}
            >
              <Group justify="space-between" mt="sm">
                <Text size="sm">{t('loadErrorBody')}</Text>
                <Text
                  id="my-report-cards-retry"
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
            <Alert icon={<IconMedal size={16} />} color={colors.info} title={t('emptyTitle')}>
              <Text size="sm">{t('emptyBody')}</Text>
            </Alert>
          ) : (
            <Stack gap="md">
              {children.length > 1 ? (
                <Stack gap={6}>
                  <Text size="sm" fw={500}>
                    {t('selectChildLabel')}
                  </Text>
                  <SegmentedControl
                    id="my-report-cards-child-picker"
                    fullWidth
                    value={selectedChild?.studentId ?? children[0].studentId}
                    onChange={setSelectedStudentId}
                    data={childOptions}
                  />
                </Stack>
              ) : null}

              {selectedChild ? (
                <Paper
                  id={`my-report-cards-child-${selectedChild.studentId}`}
                  withBorder
                  p="md"
                >
                  <Stack gap="lg">
                    <Group gap="md" wrap="nowrap" align="flex-start">
                      <Avatar radius="xl" size="lg" color="green">
                        {initials(selectedChild.studentName)}
                      </Avatar>
                      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} size="lg" lineClamp={1}>
                          {selectedChild.studentName || t('unnamedStudent')}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {t('studentIdLabel')}:{' '}
                          {selectedChild.studentStudentId || selectedChild.studentId}
                          {selectedChild.classSectionLabel
                            ? ` · ${selectedChild.classSectionLabel}`
                            : ''}
                        </Text>
                      </Stack>
                    </Group>

                    <ChildResultCards studentId={selectedChild.studentId} />
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          )}
        </Stack>
      </div>
    </>
  );
}
