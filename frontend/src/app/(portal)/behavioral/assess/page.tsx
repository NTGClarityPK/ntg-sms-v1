'use client';

import { Group, Title } from '@mantine/core';
import { BehavioralAssessContent } from '@/components/features/behavioral/BehavioralAssessContent';

export default function BehavioralAssessPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Behavioural matrix</Title>
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
