'use client';

import { Badge, Box, Card, Group, Stack, Text } from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { planDisplayName } from '@/lib/subscription/plan-transition';
import type { Subscription } from '@/types/subscription';

function formatBillingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type BillingCurrentPlanCardProps = {
  subscription: Subscription;
};

export function BillingCurrentPlanCard({ subscription }: BillingCurrentPlanCardProps) {
  const t = useTranslations('billing');
  const colors = useThemeColors();

  const cycleLabel =
    subscription.billingCycle === 'monthly' ? t('monthly') : t('yearly');
  const planTitle = `${t('currentPlan')}: ${planDisplayName(subscription.planId)} · ${cycleLabel}`;

  const statusKey =
    subscription.status === 'active'
      ? 'active'
      : subscription.status === 'past_due'
        ? 'pastDue'
        : subscription.status === 'cancelled'
          ? 'cancelled'
          : 'trial';

  return (
    <Card
      id="billing-current-plan-card"
      withBorder
      padding="xl"
      radius="md"
      shadow="xs"
    >
      <Box pos="relative">
        <Badge
          id="billing-current-plan-status-badge"
          size="lg"
          radius="xl"
          variant="filled"
          styles={{
            root: {
              position: 'absolute',
              top: 0,
              right: 0,
              backgroundColor: colors.primary,
              color: '#fff',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              paddingLeft: 16,
              paddingRight: 16,
            },
          }}
        >
          {t(statusKey)}
        </Badge>

        <Stack gap={4} pr={{ base: 0, xs: 120 }}>
          <Text fw={700} size="lg" lh={1.3}>
            {planTitle}
          </Text>
          <Text size="sm" fw={500}>
            {t('planStatusActive')}
          </Text>
        </Stack>

        <Group gap={8} mt="lg" wrap="nowrap" align="center">
          <IconCalendar size={18} stroke={1.5} style={{ flexShrink: 0 }} />
          <Text size="sm" c="dimmed">
            {t('billingPeriod')}:{' '}
            {formatBillingDate(subscription.currentPeriodStart)} –{' '}
            {formatBillingDate(subscription.currentPeriodEnd)}
          </Text>
        </Group>
      </Box>
    </Card>
  );
}
