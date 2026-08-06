'use client';

import { useMemo, useState } from 'react';
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
  Select,
  useMantineTheme,
} from '@mantine/core';
import { IconTable, IconListCheck, IconRefresh, IconHistory } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { usePendingBehavioral } from '@/hooks/useBehavioral';
import { BehavioralAssessContent } from '@/components/features/behavioral/BehavioralAssessContent';
import { FrameworkBehavioralAssessContent } from '@/components/features/behavioral/FrameworkBehavioralAssessContent';
import { FrameworkPendingContent } from '@/components/features/behavioral/FrameworkPendingContent';
import { CombinedBehavioralHistory } from '@/components/features/behavioral/CombinedBehavioralHistory';
import { useBehavioralFrameworkConfig } from '@/hooks/useBehavioralFramework';
import { useSystemSetting } from '@/hooks/useSystemSettings';
import { useStudents } from '@/hooks/useStudents';

export default function BehavioralPage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('behavioral');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('matrix');
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const pendingQuery = usePendingBehavioral();
  const pending = pendingQuery.data ?? [];
  const isLoadingPending =
    pendingQuery.isLoading || pendingQuery.isRefetching || !pendingQuery.data;

  const { data: behaviorSetting } = useSystemSetting<{ enabled?: boolean }>(
    'behavioral_assessment',
  );
  const behaviourAssessmentEnabled = Boolean(behaviorSetting?.data?.value?.enabled);

  const configQuery = useBehavioralFrameworkConfig();
  const activeSystem = configQuery.data?.activeSystem ?? 'star_based';
  const isFramework = activeSystem === 'framework_based';

  const studentsQuery = useStudents({
    limit: 50,
    isActive: true,
    search: historySearch || undefined,
    enabled: activeTab === 'history',
  });

  const studentOptions = useMemo(() => {
    const rows = studentsQuery.data?.data ?? [];
    return rows.map((s) => ({
      value: s.id,
      label:
        `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ||
        s.studentId ||
        s.id,
    }));
  }, [studentsQuery.data?.data]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['behavioral'] });
    void queryClient.invalidateQueries({ queryKey: ['behavioral-framework'] });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="sm">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={2}>
            {isMobile ? t('titleMobile') : t('title')}
          </Title>
          <Tooltip label={t('refresh')}>
            <ActionIcon
              id="behavioral-refresh"
              variant="light"
              size="lg"
              style={{ flexShrink: 0 }}
              loading={pendingQuery.isRefetching || configQuery.isFetching}
              onClick={refresh}
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

        {behaviourAssessmentEnabled && isFramework ? (
          <Alert color="teal" mb="md" id="behavioral-framework-mode-banner">
            {t('frameworkModeBanner')}
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
            <Tabs.Tab
              value="matrix"
              leftSection={<IconTable size={16} />}
              style={{ flexShrink: 0 }}
            >
              {t('matrix')}
            </Tabs.Tab>
            <Tabs.Tab
              value="pending"
              leftSection={<IconListCheck size={16} />}
              style={{ flexShrink: 0 }}
            >
              {t('pendingThisMonth')}
            </Tabs.Tab>
            <Tabs.Tab
              value="history"
              leftSection={<IconHistory size={16} />}
              style={{ flexShrink: 0 }}
            >
              {t('historyTab')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="matrix" pt="md" px={isMobile ? 0 : 'md'} pb="md">
            {behaviourAssessmentEnabled ? (
              isFramework ? (
                <FrameworkBehavioralAssessContent />
              ) : (
                <BehavioralAssessContent />
              )
            ) : null}
          </Tabs.Panel>

          <Tabs.Panel value="pending" pt="md" px={isMobile ? 0 : 'md'} pb="md">
            {behaviourAssessmentEnabled ? (
              isFramework ? (
                <FrameworkPendingContent />
              ) : (
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
              )
            ) : null}
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md" px={isMobile ? 0 : 'md'} pb="md">
            {behaviourAssessmentEnabled ? (
              <Stack gap="md">
                <Paper withBorder p="md">
                  <Select
                    id="behavioral-history-student"
                    label={t('historyStudentLabel')}
                    placeholder={t('historySelectStudent')}
                    data={studentOptions}
                    value={historyStudentId}
                    onChange={(v) => setHistoryStudentId(v)}
                    searchable
                    clearable
                    onSearchChange={setHistorySearch}
                    nothingFoundMessage={t('historyNoStudentsFound')}
                  />
                </Paper>
                <CombinedBehavioralHistory studentId={historyStudentId} />
              </Stack>
            ) : null}
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
