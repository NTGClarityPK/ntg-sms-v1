'use client';

import { useState } from 'react';
import { Group, Title, Tabs, Stack } from '@mantine/core';
import {
  IconDatabase,
  IconChartPie,
  IconFile,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { StorageOverview } from '@/components/features/storage/StorageOverview';
import { CategoryBreakdown } from '@/components/features/storage/CategoryBreakdown';
import { LargestFiles } from '@/components/features/storage/LargestFiles';
import { StorageAlerts } from '@/components/features/storage/StorageAlerts';

export default function StoragePage() {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [categoryChip, setCategoryChip] = useState<string>('all');
  const [sourceChip, setSourceChip] = useState<string>('all');
  const [alertFilterChip, setAlertFilterChip] = useState<string>('all');

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>Storage</Title>
        <Group />
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
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconDatabase size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="breakdown" leftSection={<IconChartPie size={16} />}>
              Breakdown
            </Tabs.Tab>
            <Tabs.Tab value="files" leftSection={<IconFile size={16} />}>
              Largest files
            </Tabs.Tab>
            <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>
              Alerts
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md" px="md" pb="md">
            <Stack gap="md">
              <StorageOverview />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="breakdown" pt="md" px="md" pb="md">
            <Stack gap="md">
              <CategoryBreakdown
                categoryChip={categoryChip}
                onCategoryChipChange={setCategoryChip}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="files" pt="md" px="md" pb="md">
            <Stack gap="md">
              <LargestFiles sourceChip={sourceChip} onSourceChipChange={setSourceChip} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="alerts" pt="md" px="md" pb="md">
            <Stack gap="md">
              <StorageAlerts
                filterChip={alertFilterChip}
                onFilterChipChange={setAlertFilterChip}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
