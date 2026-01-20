'use client';

import { Group, Stack, Title } from '@mantine/core';
import { CommunicationSettings } from '@/components/features/settings/CommunicationSettings';
import { LibraryCategoryEditor } from '@/components/features/settings/LibraryCategoryEditor';

export default function CommunicationSettingsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Communication Settings</Title>
        </Group>
      </div>

      <Stack gap="xl">
        <CommunicationSettings />
        <LibraryCategoryEditor />
      </Stack>
    </>
  );
}


