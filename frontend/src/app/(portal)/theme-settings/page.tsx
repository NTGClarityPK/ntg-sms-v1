'use client';

import { Group, Title } from '@mantine/core';
import { ThemeSettingsPanel } from '@/components/features/settings/ThemeSettingsPanel';

export default function ThemeSettingsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Theme Settings</Title>
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <ThemeSettingsPanel showTitle />
      </div>
    </>
  );
}

