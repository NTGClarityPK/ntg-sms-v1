'use client';

import { Paper, Title, Group, Text, RingProgress, Grid, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { AssignmentStatistics } from '@/types/reports';

interface AssignmentStatisticsSectionProps {
  data: AssignmentStatistics;
}

export function AssignmentStatisticsSection({ data }: AssignmentStatisticsSectionProps) {
  const t = useTranslations('reports');
  return (
    <Paper withBorder p="md">
      <Title order={3} mb="md">
        {t('assignmentStatsTitle')}
      </Title>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('assignmentStatsTotal')}
            </Text>
            <Text size="xl" fw={700}>{data.totalAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('assignmentStatsViewed')}
            </Text>
            <Text size="xl" fw={700} c="blue">{data.viewedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('assignmentStatsNotViewed')}
            </Text>
            <Text size="xl" fw={700} c="red">{data.notViewedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('assignmentStatsSubmitted')}
            </Text>
            <Text size="xl" fw={700} c="green">{data.submittedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('assignmentStatsInProgress')}
            </Text>
            <Text size="xl" fw={700} c="yellow">{data.inProgressAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">
              {t('assignmentStatsNotStarted')}
            </Text>
            <Text size="xl" fw={700} c="gray">{data.notStartedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Group justify="center">
            <RingProgress
              size={120}
              thickness={12}
              sections={[{ value: data.viewingRate, color: 'blue' }]}
              label={
                <Text c="blue" fw={700} ta="center" size="sm">
                  {data.viewingRate}%
                </Text>
              }
            />
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t('assignmentStatsViewingRate')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('assignmentStatsViewingSummary', {
                  viewed: data.viewedAssignments,
                  total: data.totalAssignments,
                })}
              </Text>
            </Stack>
          </Group>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Group justify="center">
            <RingProgress
              size={120}
              thickness={12}
              sections={[{ value: data.submissionRate, color: 'green' }]}
              label={
                <Text c="green" fw={700} ta="center" size="sm">
                  {data.submissionRate}%
                </Text>
              }
            />
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t('assignmentStatsSubmissionRate')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('assignmentStatsSubmissionSummary', {
                  submitted: data.submittedAssignments,
                  total: data.totalAssignments,
                })}
              </Text>
            </Stack>
          </Group>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
