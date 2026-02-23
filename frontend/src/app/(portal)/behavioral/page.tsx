'use client';

import { useState } from 'react';
import {
  Group,
  Title,
  Tabs,
  Stack,
  Text,
  Paper,
  Skeleton,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconTable, IconListCheck, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { usePendingBehavioral } from '@/hooks/useBehavioral';
import { BehavioralAssessContent } from '@/components/features/behavioral/BehavioralAssessContent';

export default function BehavioralPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('matrix');
  const pendingQuery = usePendingBehavioral();
  const pending = pendingQuery.data ?? [];
  const isLoadingPending = pendingQuery.isLoading || pendingQuery.isRefetching || !pendingQuery.data;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Behavioural Assessment</Title>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              size="lg"
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
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="matrix" leftSection={<IconTable size={16} />}>
              Matrix
            </Tabs.Tab>
            <Tabs.Tab value="pending" leftSection={<IconListCheck size={16} />}>
              Pending this month
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="matrix" pt="md" px="md" pb="md">
            <BehavioralAssessContent />
          </Tabs.Panel>

          <Tabs.Panel value="pending" pt="md" px="md" pb="md">
            <Stack gap="md">
              <Paper withBorder p="md">
                <Text size="sm" fw={500} mb="xs">
                  Students in your class sections who have not been assessed yet this month.
                </Text>
                {isLoadingPending ? (
                  <Skeleton height={80} radius="sm" />
                ) : pending.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No pending students, or you are not assigned to any class section.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {pending.slice(0, 50).map((s) => (
                      <Text key={s.id} size="sm">
                        {s.fullName}
                        {s.className || s.sectionName
                          ? ` (${[s.className, s.sectionName].filter(Boolean).join(' ')})`
                          : ''}
                      </Text>
                    ))}
                    {pending.length > 50 && (
                      <Text size="sm" c="dimmed">
                        +{pending.length - 50} more
                      </Text>
                    )}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
