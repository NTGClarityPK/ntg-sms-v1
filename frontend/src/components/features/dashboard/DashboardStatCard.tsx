'use client';

import { Card, Group, Text } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  icon: Icon;
}

export function DashboardStatCard({ title, value, icon: IconComponent }: DashboardStatCardProps) {
  const colors = useThemeColors();

  return (
    <Card withBorder padding="lg" radius="md">
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
    </Card>
  );
}
