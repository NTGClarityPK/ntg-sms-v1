'use client';

import { useTranslations } from 'next-intl';
import { Group, Title, Skeleton } from '@mantine/core';
import { BehavioralAssessContent } from '@/components/features/behavioral/BehavioralAssessContent';
import { FrameworkBehavioralAssessContent } from '@/components/features/behavioral/FrameworkBehavioralAssessContent';
import { useBehavioralFrameworkConfig } from '@/hooks/useBehavioralFramework';

export default function BehavioralAssessPage() {
  const t = useTranslations('behavioral');
  const configQuery = useBehavioralFrameworkConfig();
  const isFramework = (configQuery.data?.activeSystem ?? 'star_based') === 'framework_based';

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={2}>
            {t('matrixTitle')}
          </Title>
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
        {configQuery.isLoading ? (
          <Skeleton height={200} radius="sm" />
        ) : isFramework ? (
          <FrameworkBehavioralAssessContent />
        ) : (
          <BehavioralAssessContent />
        )}
      </div>
    </>
  );
}
