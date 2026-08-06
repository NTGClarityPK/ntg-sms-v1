'use client';

import { Group, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { BehaviorSettings } from '@/components/features/settings/BehaviorSettings';

export default function BehaviorSettingsPage() {
  const t = useTranslations('settings');

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('behaviorSettingsPageTitle')}</Title>
        </Group>
      </div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <BehaviorSettings />
      </div>
    </>
  );
}
