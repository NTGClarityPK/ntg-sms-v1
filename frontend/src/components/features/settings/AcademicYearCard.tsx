'use client';

import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import type { AcademicYear } from '@/types/settings';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface AcademicYearCardProps {
  year: AcademicYear;
  onActivate: (id: string) => void;
  onLock: (id: string) => void;
  isActivating: boolean;
  isLocking: boolean;
}

export function AcademicYearCard({ year, onActivate, onLock, isActivating, isLocking }: AcademicYearCardProps) {
  const colors = useThemeColors();

  const status = year.isLocked ? 'Locked' : year.isActive ? 'Active' : 'Inactive';
  const statusColor = year.isLocked ? colors.warning : year.isActive ? colors.success : colors.info;

  return (
    <Card withBorder p="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap="xs">
          <Text fw={600}>{year.name}</Text>
          <Text c="dimmed" size="sm">
            {year.startDate} → {year.endDate}
          </Text>
        </Stack>

        <Badge variant="light" color={statusColor}>
          {status}
        </Badge>
      </Group>

      <Group justify="flex-end" mt="md">
        <Button
          variant="light"
          disabled={year.isLocked || year.isActive}
          loading={isActivating}
          onClick={() => onActivate(year.id)}
        >
          Activate
        </Button>
        <Button variant="light" disabled={year.isLocked} loading={isLocking} onClick={() => onLock(year.id)}>
          Lock
        </Button>
      </Group>
    </Card>
  );
}


