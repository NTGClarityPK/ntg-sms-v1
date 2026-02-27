'use client';

import { useState } from 'react';
import { Progress, Text, Group, Paper, Stack, Skeleton, Alert, Button, Chip } from '@mantine/core';
import { useStorageOverview } from '@/hooks/useStorage';
import { IconAlertTriangle, IconCloudUpload } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { QuotaUpgradeModal } from './QuotaUpgradeModal';

type StorageUnit = 'mb' | 'gb';

export function StorageOverview() {
  const t = useTranslations('storage');
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [unit, setUnit] = useState<StorageUnit>('mb');
  const { data, isLoading, error } = useStorageOverview();

  if (isLoading || !data) {
    return (
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Skeleton height={24} width="40%" />
          <Skeleton height={12} />
          <Skeleton height={24} />
        </Stack>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert color="red" title={t('overviewLoadError')}>
        {error instanceof Error ? error.message : t('overviewLoadError')}
      </Alert>
    );
  }

  const usedMb = data.usedBytes / (1024 * 1024);
  const quotaMb = data.quotaGb * 1024;
  const usedGb = data.usedBytes / (1024 * 1024 * 1024);

  const formatUsage = () => {
    if (unit === 'gb') {
      return `${usedGb.toFixed(2)} GB / ${data.quotaGb.toFixed(2)} GB (${data.usedPercentage.toFixed(1)}%)`;
    }
    return `${usedMb.toFixed(2)} MB / ${quotaMb.toFixed(0)} MB (${data.usedPercentage.toFixed(1)}%)`;
  };

  const getColor = () => {
    if (data.usedPercentage >= 95) return 'red';
    if (data.usedPercentage >= 80) return 'yellow';
    return 'blue';
  };

  return (
    <>
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Group gap="md">
              <Text fw={600}>{t('branchStorage')}</Text>
              <Chip.Group
                value={unit}
                onChange={(v) => setUnit((Array.isArray(v) ? v[0] : v) as StorageUnit ?? 'mb')}
              >
                <Group gap="xs">
                  <Chip value="mb" variant="filled" size="xs">MB</Chip>
                  <Chip value="gb" variant="filled" size="xs">GB</Chip>
                </Group>
              </Chip.Group>
            </Group>
            <Group gap="xs">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconCloudUpload size={14} />}
                onClick={() => setUpgradeModalOpen(true)}
              >
                {t('requestMoreStorage')}
              </Button>
              <Text size="sm" c="dimmed">{formatUsage()}</Text>
            </Group>
          </Group>
          <Progress value={data.usedPercentage} color={getColor()} size="lg" radius="xl" />
          {data.usedPercentage >= 80 && (
            <Alert color={data.usedPercentage >= 95 ? 'red' : 'yellow'} icon={<IconAlertTriangle size={16} />}>
              <Text size="sm">
                {data.usedPercentage >= 95
                  ? t('quotaCriticalMessage')
                  : t('quotaWarningMessage')}
              </Text>
            </Alert>
          )}
        </Stack>
      </Paper>
      <QuotaUpgradeModal opened={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
    </>
  );
}
