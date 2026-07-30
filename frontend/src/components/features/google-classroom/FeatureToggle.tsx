'use client';

import { Stack, Switch, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import {
  useGoogleWorkspaceSettings,
  useUpdateGoogleWorkspaceSettings,
} from '@/hooks/api/useGoogleWorkspace';

export function FeatureToggle() {
  const t = useTranslations('googleClassroom');
  const { data: settings, isLoading } = useGoogleWorkspaceSettings();
  const updateSettings = useUpdateGoogleWorkspaceSettings();

  const enabled = settings?.isFeatureEnabled ?? false;

  return (
    <Stack gap="xs">
      <Switch
        id="google-classroom-feature-toggle"
        label={t('enableFeature')}
        description={t('enableFeatureDescription')}
        checked={enabled}
        disabled={isLoading || updateSettings.isPending}
        onChange={(e) => {
          updateSettings.mutate(e.currentTarget.checked);
        }}
      />
      {!enabled && (
        <Text size="sm" c="dimmed">
          {t('featureDisabled')}
        </Text>
      )}
    </Stack>
  );
}
