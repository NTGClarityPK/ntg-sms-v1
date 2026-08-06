'use client';

import { useTranslations } from 'next-intl';
import { Badge, Paper, Skeleton, Stack, Text, Group, Divider, List } from '@mantine/core';
import { useCombinedBehavioralHistory } from '@/hooks/useBehavioralFramework';
import {
  isFrameworkHistoryPayload,
  isStarHistoryPayload,
  type CombinedHistoryEntry,
} from '@/types/behavioral-framework';

interface CombinedBehavioralHistoryProps {
  studentId: string | null;
  academicYearId?: string;
}

function HistoryEntryCard({ entry }: { entry: CombinedHistoryEntry }) {
  const t = useTranslations('behavioral');

  return (
    <Paper withBorder p="sm" radius="sm">
      <Stack gap="xs">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm" fw={600}>
            {entry.period.slice(0, 7)}
          </Text>
          <Badge
            variant="light"
            color={entry.systemType === 'framework_based' ? 'teal' : 'blue'}
          >
            {entry.systemType === 'framework_based'
              ? t('historySystemFramework')
              : t('historySystemStar')}
          </Badge>
        </Group>

        {isStarHistoryPayload(entry) ? (
          <List size="sm" spacing={4}>
            {entry.payload.scores.map((score) => (
              <List.Item key={score.id}>
                {score.attributeName}: {score.score}/5
              </List.Item>
            ))}
          </List>
        ) : null}

        {isFrameworkHistoryPayload(entry) ? (
          <Stack gap={6}>
            {entry.payload.periodLabel ? (
              <Text size="xs" c="dimmed">
                {entry.payload.periodLabel}
              </Text>
            ) : null}
            {entry.payload.categoryScores.map((score) => (
              <Stack key={score.id} gap={2}>
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {score.categoryName}
                  </Text>
                  <Badge size="sm" variant="outline">
                    {score.ratingCode}
                  </Badge>
                </Group>
                {score.teacherComment ? (
                  <Text size="xs" c="dimmed">
                    {score.teacherComment}
                  </Text>
                ) : null}
              </Stack>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}

/**
 * Combined star + framework behavioural timeline for a student.
 */
export function CombinedBehavioralHistory({
  studentId,
  academicYearId,
}: CombinedBehavioralHistoryProps) {
  const t = useTranslations('behavioral');
  const historyQuery = useCombinedBehavioralHistory(studentId, academicYearId);

  if (!studentId) {
    return (
      <Paper withBorder p="md">
        <Text size="sm" c="dimmed">
          {t('historySelectStudent')}
        </Text>
      </Paper>
    );
  }

  if (historyQuery.isLoading) {
    return (
      <Paper withBorder p="md">
        <Skeleton height={140} radius="sm" />
      </Paper>
    );
  }

  const entries = historyQuery.data?.entries ?? [];

  if (entries.length === 0) {
    return (
      <Paper withBorder p="md">
        <Text size="sm" c="dimmed">
          {t('noAssessmentsYet')}
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Text fw={600}>{t('historyCombinedTitle')}</Text>
        <Divider />
        <Stack gap="sm">
          {entries.map((entry) => (
            <HistoryEntryCard
              key={`${entry.systemType}-${entry.period}-${
                isStarHistoryPayload(entry) ? entry.payload.id : entry.payload.id
              }`}
              entry={entry}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
