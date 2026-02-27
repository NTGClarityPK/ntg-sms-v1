'use client';

import { Title, Text, Stack } from '@mantine/core';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function AssessmentStatisticsPage() {
  const t = useTranslations('assessment');
  const params = useParams();
  const assessmentId = params?.id as string;

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('statisticsTitle')}</Title>
      </div>
      <div
        style={{
          marginTop: '60px',
          padding: 'var(--mantine-spacing-md)',
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {assessmentId ? t('statisticsSubtitle') : t('assessmentNotFound')}
          </Text>
        </Stack>
      </div>
    </>
  );
}
