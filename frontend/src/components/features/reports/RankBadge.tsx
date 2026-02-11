'use client';

import { Badge, Text } from '@mantine/core';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface RankBadgeProps {
  rank?: number;
  percentile?: number;
}

/**
 * Displays rank (1–3) or percentile (e.g. "Top 40%").
 */
export function RankBadge({ rank, percentile }: RankBadgeProps) {
  const { primary } = useThemeColors();

  if (rank != null && rank >= 1 && rank <= 3) {
    return (
      <Badge size="sm" color={primary} variant="light">
        Rank {rank}
      </Badge>
    );
  }
  if (percentile != null) {
    return (
      <Text size="sm" c="dimmed">
        Top {percentile}%
      </Text>
    );
  }
  return <Text size="sm" c="dimmed">—</Text>;
}
