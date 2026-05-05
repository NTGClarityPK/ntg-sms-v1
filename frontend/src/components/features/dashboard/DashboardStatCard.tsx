'use client';

import { Card, Group, Text } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import Link from 'next/link';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  icon: Icon;
  /** When set, the whole card navigates here (client-side). */
  href?: string;
  id?: string;
}

const linkCardStyles = {
  root: {
    textDecoration: 'none' as const,
    color: 'inherit' as const,
    cursor: 'pointer' as const,
    display: 'block' as const,
    transition: 'background-color 150ms ease',
    '&:hover': {
      backgroundColor: 'var(--mantine-color-default-hover)',
    },
  },
};

export function DashboardStatCard({
  title,
  value,
  icon: IconComponent,
  href,
  id,
}: DashboardStatCardProps) {
  const colors = useThemeColors();

  const body = (
    <Group justify="space-between">
      <div>
        <Text size="xs" tt="uppercase" fw={700} c="dimmed">
          {title}
        </Text>
        <Text fw={700} size="xl">
          {value}
        </Text>
      </div>
      <IconComponent size={32} stroke={1.5} style={{ color: colors.primary }} />
    </Group>
  );

  if (href) {
    return (
      <Card
        component={Link}
        href={href}
        id={id}
        withBorder
        padding="lg"
        radius="md"
        styles={linkCardStyles}
      >
        {body}
      </Card>
    );
  }

  return (
    <Card withBorder padding="lg" radius="md" id={id}>
      {body}
    </Card>
  );
}
