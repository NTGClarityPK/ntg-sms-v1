'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Group,
  Title,
  Tabs,
  Stack,
  Text,
  Paper,
  Skeleton,
  Tooltip,
  ActionIcon,
  useMantineTheme,
} from '@mantine/core';
import { IconTable, IconListCheck, IconRefresh } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { usePendingBehavioral } from '@/hooks/useBehavioral';
import { BehavioralAssessContent } from '@/components/features/behavioral/BehavioralAssessContent';
import { useSystemSetting } from '@/hooks/useSystemSettings';

export default function BehavioralPage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('behavioral');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('matrix');
  const pendingQuery = usePendingBehavioral();
  const pending = pendingQuery.data ?? [];
  const isLoadingPending = pendingQuery.isLoading || pendingQuery.isRefetching || !pendingQuery.data;

  const { data: behaviorSetting } = useSystemSetting<{ enabled?: boolean }>('behavioral_assessment');
  const behaviourAssessmentEnabled = Boolean(behaviorSetting?.data?.value?.enabled);

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="sm">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={2}>
            {isMobile ? t('titleMobile') : t('title')}
          </Title>
          <Tooltip label={t('refresh')}>
            <ActionIcon
              variant="light"
              size="lg"
              style={{ flexShrink: 0 }}
              loading={pendingQuery.isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['behavioral'] })}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>
      <div className="page-sub-title-bar" />
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        {!behaviourAssessmentEnabled ? (
          <Alert color="gray" title={t('assessmentDisabledTitle')} mb="md">
            {t('assessmentDisabledMessage')}
          </Alert>
        ) : null}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List
            style={{
              flexWrap: 'nowrap',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <Tabs.Tab value="matrix" leftSection={<IconTable size={16} />} style={{ flexShrink: 0 }}>
              {t('matrix')}
            </Tabs.Tab>
            <Tabs.Tab value="pending" leftSection={<IconListCheck size={16} />} style={{ flexShrink: 0 }}>
              {t('pendingThisMonth')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="matrix" pt="md" px={isMobile ? 0 : 'md'} pb="md">
            {behaviourAssessmentEnabled ? <BehavioralAssessContent /> : null}
          </Tabs.Panel>

          <Tabs.Panel value="pending" pt="md" px={isMobile ? 0 : 'md'} pb="md">
            {behaviourAssessmentEnabled ? (
              <Stack gap="md">
                <Paper withBorder p="md">
                  <Text size="sm" fw={500} mb="xs">
                    {t('pendingDescription')}
                  </Text>
                  {isLoadingPending ? (
                    <Skeleton height={80} radius="sm" />
                  ) : pending.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t('noPending')}
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {pending.slice(0, 50).map((s) => (
                        <Text key={s.id} size="sm">
                          {`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'N/A'}
                          {s.className || s.sectionName
                            ? ` (${[s.className, s.sectionName].filter(Boolean).join(' ')})`
                            : ''}
                        </Text>
                      ))}
                      {pending.length > 50 && (
                        <Text size="sm" c="dimmed">
                          {t('moreCount', { count: pending.length - 50 })}
                        </Text>
                      )}
                    </Stack>
                  )}
                </Paper>
              </Stack>
            ) : null}
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
