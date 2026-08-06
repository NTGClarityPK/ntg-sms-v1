'use client';

import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';

interface FrameworkPresetPickerProps {
  onUseOntario: () => void;
  onCreateBlank: () => void;
  ontarioLoading?: boolean;
  blankLoading?: boolean;
}

export function FrameworkPresetPicker({
  onUseOntario,
  onCreateBlank,
  ontarioLoading = false,
  blankLoading = false,
}: FrameworkPresetPickerProps) {
  const t = useTranslations('settings');

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={600}>{t('behaviorFrameworkPresetPickerTitle')}</Text>
          <Text size="sm" c="dimmed">
            {t('behaviorFrameworkPresetPickerHint')}
          </Text>
        </Stack>

        <Paper withBorder p="sm" radius="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={2} style={{ flex: 1, minWidth: 200 }}>
              <Text size="sm" fw={500}>
                {t('behaviorFrameworkOntarioTitle')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('behaviorFrameworkOntarioDescription')}
              </Text>
            </Stack>
            <Button
              id="behavior-framework-use-ontario"
              variant="light"
              onClick={onUseOntario}
              loading={!blankLoading && ontarioLoading}
              disabled={blankLoading}
            >
              {t('behaviorFrameworkUseOntario')}
            </Button>
          </Group>
        </Paper>

        <Paper withBorder p="sm" radius="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap={2} style={{ flex: 1, minWidth: 200 }}>
              <Text size="sm" fw={500}>
                {t('behaviorFrameworkBlankTitle')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('behaviorFrameworkBlankDescription')}
              </Text>
            </Stack>
            <Button
              id="behavior-framework-create-blank"
              variant="light"
              onClick={onCreateBlank}
              loading={!ontarioLoading && blankLoading}
              disabled={ontarioLoading}
            >
              {t('behaviorFrameworkCreateBlank')}
            </Button>
          </Group>
        </Paper>
      </Stack>
    </Paper>
  );
}
