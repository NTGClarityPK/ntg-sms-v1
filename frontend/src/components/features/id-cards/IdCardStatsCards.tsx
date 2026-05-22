'use client';

import { useTranslations } from 'next-intl';
import { SimpleGrid, Skeleton } from '@mantine/core';
import { IconCamera, IconClock, IconId, IconFile } from '@tabler/icons-react';
import { DashboardStatCard } from '@/components/features/dashboard/DashboardStatCard';
import type { IdCardStats } from '@/types/id-cards';

type Props = {
  stats?: IdCardStats;
  isLoading?: boolean;
};

export function IdCardStatsCards({ stats, isLoading }: Props) {
  const t = useTranslations('idCards');

  if (isLoading) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={88} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  if (!stats) return null;

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
      <DashboardStatCard
        id="id-cards-stat-issued"
        title={t('stats.issuedLabel')}
        value={stats.issued}
        icon={IconId}
      />
      <DashboardStatCard
        id="id-cards-stat-pending"
        title={t('stats.pendingLabel')}
        value={stats.pending}
        icon={IconClock}
      />
      <DashboardStatCard
        id="id-cards-stat-missing-photos"
        title={t('stats.missingPhotosLabel')}
        value={stats.missingPhotos}
        icon={IconCamera}
      />
      <DashboardStatCard
        id="id-cards-stat-draft"
        title={t('stats.draftLabel')}
        value={stats.draft}
        icon={IconFile}
      />
    </SimpleGrid>
  );
}
