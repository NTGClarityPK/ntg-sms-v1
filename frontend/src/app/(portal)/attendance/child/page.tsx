'use client';

import { useTranslations } from 'next-intl';
import { Group, Title } from '@mantine/core';
import { ChildAttendanceContent } from '@/components/features/attendance/ChildAttendanceContent';

export default function ChildAttendancePage() {
  const t = useTranslations('attendance');
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('childAttendanceTitle')}</Title>
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
        <ChildAttendanceContent />
      </div>
    </>
  );
}
