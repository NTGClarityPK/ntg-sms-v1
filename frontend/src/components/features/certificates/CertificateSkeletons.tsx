'use client';

import { Grid, Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

type HistorySkeletonProps = {
  mine?: boolean;
};

export function CertificateSettingsFormSkeleton() {
  return (
    <Paper withBorder p="md" radius="md" id="cert-settings-skeleton">
      <Stack gap="md">
        <Skeleton height={22} width="40%" />
        <Skeleton height={36} width={160} />
        <Skeleton height={18} width="35%" />
        <Skeleton height={14} width="70%" />
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="sm">
              <Skeleton height={14} width="30%" />
              <Skeleton height={36} />
              <SimpleGrid cols={5} spacing="xs">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={i} height={36} radius="md" />
                ))}
              </SimpleGrid>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="xs">
              <Skeleton height={14} width="40%" />
              <Skeleton height={120} radius="md" />
              <Group grow>
                <Skeleton height={52} radius="md" />
                <Skeleton height={52} radius="md" />
                <Skeleton height={52} radius="md" />
              </Group>
            </Stack>
          </Grid.Col>
        </Grid>
        <Skeleton height={14} width="25%" />
        <Skeleton height={36} />
        <Skeleton height={14} width="25%" />
        <Skeleton height={36} />
        <Skeleton height={14} width="25%" />
        <Skeleton height={36} />
        <Group justify="flex-end">
          <Skeleton height={36} width={120} />
        </Group>
      </Stack>
    </Paper>
  );
}

export function CertificateHistoryTableSkeleton({ mine = false }: HistorySkeletonProps) {
  const filterCount = mine ? 4 : 5;
  return (
    <Stack gap="md" id="cert-history-skeleton">
      <Group grow align="flex-end">
        {Array.from({ length: filterCount }, (_, i) => (
          <Stack key={i} gap={6}>
            <Skeleton height={12} width="55%" />
            <Skeleton height={36} />
          </Stack>
        ))}
      </Group>
      {!mine && <Skeleton height={36} width={140} />}
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Skeleton height={36} />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={48} radius="sm" />
          ))}
        </Stack>
      </Paper>
      <Skeleton height={32} width={240} />
    </Stack>
  );
}

export function CertificateFieldSkeleton() {
  return (
    <Stack gap="md" id="cert-field-skeleton">
      {Array.from({ length: 4 }, (_, i) => (
        <Stack key={i} gap={6}>
          <Skeleton height={12} width="35%" />
          <Skeleton height={36} />
        </Stack>
      ))}
    </Stack>
  );
}

type PreviewSkeletonProps = {
  isLandscape: boolean;
};

export function CertificateLivePreviewSkeleton({ isLandscape }: PreviewSkeletonProps) {
  const minHeight = isLandscape ? 280 : 420;
  return (
    <Stack gap="xs">
      <Skeleton height={14} width={120} />
      <Paper withBorder radius="md" p="xs">
        <Skeleton height={minHeight} radius="md" />
      </Paper>
    </Stack>
  );
}

export function CertificateSelectFieldSkeleton() {
  return (
    <Stack gap={6}>
      <Skeleton height={12} width="30%" />
      <Skeleton height={36} radius="sm" />
    </Stack>
  );
}
