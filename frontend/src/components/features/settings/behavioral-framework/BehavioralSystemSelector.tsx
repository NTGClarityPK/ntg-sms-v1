'use client';

import { Button, Group, Paper, Radio, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { BehavioralActiveSystem } from '@/types/behavioral-framework';

interface BehavioralSystemSelectorProps {
  activeSystem: BehavioralActiveSystem;
  selectedSystem: BehavioralActiveSystem;
  onSelectSystem: (system: BehavioralActiveSystem) => void;
  onRequestSwitch: () => void;
  switchDisabled?: boolean;
  switchLoading?: boolean;
}

export function BehavioralSystemSelector({
  activeSystem,
  selectedSystem,
  onSelectSystem,
  onRequestSwitch,
  switchDisabled = false,
  switchLoading = false,
}: BehavioralSystemSelectorProps) {
  const t = useTranslations('settings');

  const needsSwitch = selectedSystem !== activeSystem;

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={600}>{t('behaviorFrameworkSystemTitle')}</Text>
          <Text size="sm" c="dimmed">
            {t('behaviorFrameworkSystemHint')}
          </Text>
        </Stack>

        <Radio.Group
          id="behavior-framework-system"
          value={selectedSystem}
          onChange={(value) => onSelectSystem(value as BehavioralActiveSystem)}
        >
          <Stack gap="sm">
            <Radio
              id="behavior-framework-system-star"
              value="star_based"
              label={
                <Stack gap={2}>
                  <Text size="sm" fw={500}>
                    {t('behaviorFrameworkStarLabel')}
                    {activeSystem === 'star_based' ? ` (${t('behaviorFrameworkCurrent')})` : ''}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('behaviorFrameworkStarDescription')}
                  </Text>
                </Stack>
              }
            />
            <Radio
              id="behavior-framework-system-framework"
              value="framework_based"
              label={
                <Stack gap={2}>
                  <Text size="sm" fw={500}>
                    {t('behaviorFrameworkFrameworkLabel')}
                    {activeSystem === 'framework_based'
                      ? ` (${t('behaviorFrameworkCurrent')})`
                      : ''}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('behaviorFrameworkFrameworkDescription')}
                  </Text>
                </Stack>
              }
            />
          </Stack>
        </Radio.Group>

        {needsSwitch && (
          <Group justify="flex-end">
            <Button
              id="behavior-framework-switch"
              variant="light"
              onClick={onRequestSwitch}
              disabled={switchDisabled}
              loading={!switchDisabled && switchLoading}
            >
              {selectedSystem === 'framework_based'
                ? t('behaviorFrameworkSwitchToFramework')
                : t('behaviorFrameworkSwitchToStar')}
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
