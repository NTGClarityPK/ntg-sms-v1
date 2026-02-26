'use client';

import { useTranslations } from 'next-intl';
import { Group, Title } from '@mantine/core';
import { BehavioralAssessContent } from '@/components/features/behavioral/BehavioralAssessContent';

export default function BehavioralAssessPage() {
  const t = useTranslations('behavioral');
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('matrixTitle')}</Title>
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
        <BehavioralAssessContent />
      </div>
    </>
  );
}
