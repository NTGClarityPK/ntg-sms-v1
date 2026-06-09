'use client';

import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Group, Skeleton, Title } from '@mantine/core';
import { SubstitutionAssignContent } from '@/components/features/substitutions/SubstitutionAssignContent';

function AssignFallback() {
  return <Skeleton height={200} />;
}

export default function SubstitutionAssignPage() {
  const t = useTranslations('substitution');

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('assignTitle')}</Title>
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
        <Suspense fallback={<AssignFallback />}>
          <SubstitutionAssignContent />
        </Suspense>
      </div>
    </>
  );
}
