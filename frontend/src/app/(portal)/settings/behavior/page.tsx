'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Group, Skeleton, Stack, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { BehaviorSettings } from '@/components/features/settings/BehaviorSettings';
import { useSubscriptionFeatures } from '@/hooks/api/useSubscription';

export default function BehaviorSettingsPage() {
  const t = useTranslations('settings');
  const router = useRouter();
  const { data: features, isLoading: featuresLoading } = useSubscriptionFeatures();

  useEffect(() => {
    if (features && !features.hasBehavioralTracking) {
      router.replace('/settings');
    }
  }, [features, router]);

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
        {featuresLoading || !features ? (
          <Stack gap="md">
            <Skeleton height={120} radius="md" />
            <Skeleton height={80} radius="md" />
            <Skeleton height={200} radius="md" />
          </Stack>
        ) : !features.hasBehavioralTracking ? null : (
          <BehaviorSettings />
        )}
      </div>
    </>
  );
}
