'use client';

import { Card, Grid, Progress, Text, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { PlanLimits, SubscriptionUsage } from '@/types/subscription';

const USAGE_ICONS: Record<'branches' | 'students' | 'staff' | 'classes', string> = {
  branches: '🏫',
  students: '🎓',
  staff: '👨‍🏫',
  classes: '📚',
};

/** Bar fill for capped limits (0–100% of quota). */
function usagePercent(used: number, limit: number): number {
  if (limit === -1) return unlimitedUsagePercent(used);
  if (limit <= 0) return used > 0 ? 100 : 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Unlimited plans: bar is illustrative only (label still shows "X / Unlimited").
 * Uses a fixed visual scale so non-zero usage is visible (e.g. 62 staff → ~62%).
 */
function unlimitedUsagePercent(used: number): number {
  if (used <= 0) return 0;
  const VISUAL_CAP = 100;
  return Math.min(100, Math.round((used / VISUAL_CAP) * 100));
}

type BillingUsageCardProps = {
  usage: SubscriptionUsage;
  limits: PlanLimits;
};

export function BillingUsageCard({ usage, limits }: BillingUsageCardProps) {
  const t = useTranslations('billing');

  const rows = [
    ['branches', usage.branchesUsed, limits.branches, t('branches')] as const,
    ['students', usage.studentsUsed, limits.students, t('students')] as const,
    ['staff', usage.staffUsed, limits.staff, t('staff')] as const,
    ['classes', usage.classesUsed, limits.classes, t('classes')] as const,
  ];

  return (
    <Card withBorder padding="lg" radius="md" id="billing-usage-card">
      <Title order={4} mb="md" fw={700}>
        {t('usage')}
      </Title>
      <Grid>
        {rows.map(([key, used, limit, label]) => (
          <Grid.Col key={key} span={{ base: 12, sm: 6 }}>
            <Text size="sm" fw={600}>
              {USAGE_ICONS[key]} {label}
            </Text>
            <Progress value={usagePercent(used, limit)} size="lg" mt="xs" />
            <Text size="xs" c="dimmed" mt={4}>
              {used} / {limit === -1 ? t('unlimited') : limit}
            </Text>
          </Grid.Col>
        ))}
      </Grid>
    </Card>
  );
}
