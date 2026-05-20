'use client';

import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { IconSparkles, IconStarFilled } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { getThemeColorShade } from '@/lib/utils/theme';
import { useSubscription } from '@/hooks/api/useSubscription';
import { planDisplayName } from '@/lib/subscription/plan-transition';
import type { PlanId } from '@/types/subscription';

const BADGE_HEIGHT = 32;

export function SubscriptionBadge() {
  const router = useRouter();
  const t = useTranslations('billing');
  const colors = useThemeColors();
  const { data: subscription } = useSubscription();

  const gradientStyle = useMemo(
    () => ({
      background: `linear-gradient(90deg, ${getThemeColorShade(8)} 0%, ${getThemeColorShade(5)} 55%, ${getThemeColorShade(4)} 100%)`,
      boxShadow: `0 2px 8px ${colors.primary}40`,
    }),
    [colors.primary],
  );

  if (!subscription || subscription.planId === 'enterprise') {
    return null;
  }

  const planId = subscription.planId as PlanId;
  const label = planDisplayName(planId);

  return (
    <UnstyledButton
      id="header-subscription-badge"
      onClick={() => router.push('/billing')}
      style={{
        borderRadius: 9999,
        height: BADGE_HEIGHT,
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        ...gradientStyle,
      }}
    >
      <Group gap={0} wrap="nowrap" h="100%" align="stretch">
        <Group
          gap={6}
          wrap="nowrap"
          px="sm"
          align="center"
          justify="center"
          style={{ flexShrink: 0 }}
        >
          <IconStarFilled size={14} color="#fff" stroke={1.5} />
          <Text size="sm" fw={700} c="white" lh={1}>
            {label}
          </Text>
        </Group>

        <Box
          style={{
            width: 1,
            alignSelf: 'stretch',
            margin: '6px 0',
            backgroundColor: 'rgba(255, 255, 255, 0.35)',
          }}
          aria-hidden
        />
        <Group
          gap={6}
          wrap="nowrap"
          px="sm"
          align="center"
          justify="center"
          style={{ flexShrink: 0 }}
        >
          <IconSparkles size={14} color="#fff" stroke={1.75} />
          <Text
            size="sm"
            fw={700}
            c="white"
            lh={1}
            style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            {t('upgrade')}
          </Text>
        </Group>
      </Group>
    </UnstyledButton>
  );
}
