'use client';

import { Card, Grid, Progress, Text, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { PlanLimits, SubscriptionUsage } from '@/types/subscription';

const USAGE_ICONS: Record<'branches' | 'students' | 'storage', string> = {
  branches: '🏫',
  students: '🎓',
  storage: '💾',
};

/** Bar fill for capped limits (0–100% of quota). */
function usagePercent(used: number, limit: number): number {
  if (limit === -1) return unlimitedUsagePercent(used);
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function unlimitedUsagePercent(used: number): number {
  if (used <= 0) return 0;
  const VISUAL_CAP = 100;
  return Math.min(100, Math.round((used / VISUAL_CAP) * 100));
}

function formatStorageMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

type BillingUsageCardProps = {
  usage: SubscriptionUsage;
  limits: PlanLimits;
};

export function BillingUsageCard({ usage, limits }: BillingUsageCardProps) {
  const t = useTranslations('billing');

  const rows = [
    ['branches', usage.branchesUsed, limits.branches, t('branches'), false] as const,
    ['students', usage.studentsUsed, limits.students, t('students'), false] as const,
    ['storage', usage.storageUsedMb, limits.storageMB, t('storage'), true] as const,
  ];

  return (
    <Card withBorder padding="lg" radius="md" id="billing-usage-card">
      <Title order={4} mb="md" fw={700}>
        {t('usage')}
      </Title>
      <Grid>
        {rows.map(([key, used, limit, label, isStorage]) => (
          <Grid.Col key={key} span={{ base: 12, sm: 6 }}>
            <Text size="sm" fw={600}>
              {USAGE_ICONS[key]} {label}
            </Text>
            <Progress value={usagePercent(used, limit)} size="lg" mt="xs" />
            <Text size="xs" c="dimmed" mt={4}>
              {isStorage ? formatStorageMb(used) : used}
              {' / '}
              {limit === -1
                ? t('unlimited')
                : isStorage
                  ? formatStorageMb(limit)
                  : limit}
            </Text>
          </Grid.Col>
        ))}
      </Grid>
    </Card>
  );
}
