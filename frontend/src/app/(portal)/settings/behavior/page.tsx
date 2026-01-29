'use client';

import { Group, Title } from '@mantine/core';
import { BehaviorSettings } from '@/components/features/settings/BehaviorSettings';

export default function BehaviorSettingsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Behavior Settings</Title>
        </Group>
      </div>

      <BehaviorSettings />
    </>
  );
}


