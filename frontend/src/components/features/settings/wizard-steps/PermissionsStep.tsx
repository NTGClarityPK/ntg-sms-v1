'use client';

import { Button, Group, Stack, Text } from '@mantine/core';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { PermissionData } from './types';

interface PermissionsStepProps {
  data: PermissionData[];
  onChange: (data: PermissionData[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PermissionsStep({ data, onChange, onNext, onBack }: PermissionsStepProps) {
  const colors = useThemeColors();

  const handleNext = () => {
    // Permissions are optional - can proceed even if empty
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        Permissions
      </Text>
      <Text size="sm" c="dimmed">
        Configure role-based permissions. You can set these up later from the Permissions settings page.
      </Text>

      <Stack gap="lg" mt="md">
        <Text size="sm" c="dimmed">
          Permissions configuration can be completed after initial setup. Click Next to proceed to review.
        </Text>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button variant="light" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext} color={colors.primary}>
          Next
        </Button>
      </Group>
    </Stack>
  );
}

