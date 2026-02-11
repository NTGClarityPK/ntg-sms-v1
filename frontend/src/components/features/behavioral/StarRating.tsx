'use client';

import { Group, ActionIcon } from '@mantine/core';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

const MAX_STARS = 5;

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: number;
}

/**
 * 1–5 star rating input. Uses theme primary for active star colour.
 */
export function StarRating({ value, onChange, readonly = false, size = 22 }: StarRatingProps) {
  const { primary } = useThemeColors();
  const clamped = Math.min(MAX_STARS, Math.max(0, Math.round(value)));

  return (
    <Group gap={2} wrap="nowrap">
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= clamped;
        const StarIcon = filled ? IconStarFilled : IconStar;
        return (
          <ActionIcon
            key={i}
            variant="subtle"
            color={primary}
            size={size}
            radius="sm"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(starValue)}
            style={{ cursor: readonly ? 'default' : 'pointer' }}
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
          >
            <StarIcon size={size - 6} color={filled ? primary : undefined} />
          </ActionIcon>
        );
      })}
    </Group>
  );
}
