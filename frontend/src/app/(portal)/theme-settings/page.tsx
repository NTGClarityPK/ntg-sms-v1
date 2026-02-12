'use client';

import { Group, Title } from '@mantine/core';
import { ThemeSettingsPanel } from '@/components/features/settings/ThemeSettingsPanel';
import { useAuth } from '@/hooks/useAuth';

export default function ThemeSettingsPage() {
  const { user } = useAuth();
  const isSchoolAdmin = user?.roles?.some((r) => r.roleName?.toLowerCase() === 'school_admin') || false;

  if (!isSchoolAdmin) return null;

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

