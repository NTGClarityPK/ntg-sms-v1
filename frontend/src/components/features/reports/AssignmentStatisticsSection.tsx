'use client';

import { Paper, Title, Group, Text, RingProgress, Grid, Stack } from '@mantine/core';
import type { AssignmentStatistics } from '@/types/reports';

interface AssignmentStatisticsSectionProps {
  data: AssignmentStatistics;
}

export function AssignmentStatisticsSection({ data }: AssignmentStatisticsSectionProps) {
  return (
    <Paper withBorder p="md">
      <Title order={3} mb="md">Assignment Statistics</Title>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">Total Assignments</Text>
            <Text size="xl" fw={700}>{data.totalAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">Viewed</Text>
            <Text size="xl" fw={700} c="blue">{data.viewedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">Not Viewed</Text>
            <Text size="xl" fw={700} c="red">{data.notViewedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">Submitted</Text>
            <Text size="xl" fw={700} c="green">{data.submittedAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">In Progress</Text>
            <Text size="xl" fw={700} c="yellow">{data.inProgressAssignments}</Text>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Stack gap="xs" align="center">
            <Text size="sm" c="dimmed">Not Started</Text>
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
              <Text size="sm" fw={600}>Viewing Rate</Text>
              <Text size="xs" c="dimmed">
                {data.viewedAssignments} of {data.totalAssignments} assignments viewed
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
              <Text size="sm" fw={600}>Submission Rate</Text>
              <Text size="xs" c="dimmed">
                {data.submittedAssignments} of {data.totalAssignments} assignments submitted
              </Text>
            </Stack>
          </Group>
        </Grid.Col>
      </Grid>
    </Paper>
  );
}
