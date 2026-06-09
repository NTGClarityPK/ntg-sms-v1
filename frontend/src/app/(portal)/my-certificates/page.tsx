'use client';

import { useTranslations } from 'next-intl';
import { Stack, Title } from '@mantine/core';
import { CertificateHistoryTable } from '@/components/features/certificates/CertificateHistoryTable';

export default function MyCertificatesPage() {
  const t = useTranslations('certificates');

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('myTitle')}</Title>
      </div>
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <CertificateHistoryTable mine />
        </Stack>
      </div>
    </>
  );
}
