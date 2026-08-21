'use client';

import { useTranslations } from 'next-intl';
import { Title } from '@mantine/core';
import { FeeReportsContent } from '@/components/features/reports/FeeReportsContent';

export default function FeeReportsPage() {
  const t = useTranslations('feesReports');

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('title')}</Title>
      </div>
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <FeeReportsContent />
      </div>
    </>
  );
}
