'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Group, Title, Tabs, Stack } from '@mantine/core';
import {
  IconDatabase,
  IconChartPie,
  IconFile,
  IconAlertTriangle,
  IconCloud,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { StorageOverview } from '@/components/features/storage/StorageOverview';
import { CategoryBreakdown } from '@/components/features/storage/CategoryBreakdown';
import { LargestFiles } from '@/components/features/storage/LargestFiles';
import { StorageAlerts } from '@/components/features/storage/StorageAlerts';
import { StorageManager } from '@/components/features/offline/StorageManager';

const VALID_TABS = ['overview', 'breakdown', 'files', 'alerts', 'cache'] as const;
const SUPER_ADMIN_ONLY_TABS = ['cache'] as const;

export default function StoragePage() {
  const t = useTranslations('storage');
  const { user } = useAuth();
  const isSuperAdmin =
    user?.roles?.some((r) => r.roleName?.toLowerCase() === 'super_admin') ?? false;
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState<string | null>(
    tabFromUrl && VALID_TABS.includes(tabFromUrl as (typeof VALID_TABS)[number])
      ? tabFromUrl
      : 'overview'
  );
  const [categoryChip, setCategoryChip] = useState<string>('all');
  const [sourceChip, setSourceChip] = useState<string>('all');
  const [alertFilterChip, setAlertFilterChip] = useState<string>('all');

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl as (typeof VALID_TABS)[number]) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // If non–super-admin lands on cache, switch to overview
  useEffect(() => {
    if (!isSuperAdmin && activeTab && SUPER_ADMIN_ONLY_TABS.includes(activeTab as (typeof SUPER_ADMIN_ONLY_TABS)[number])) {
      setActiveTab('overview');
      router.replace(pathname, { scroll: false });
    }
  }, [isSuperAdmin, activeTab, pathname, router]);

  const handleTabChange = (value: string | null) => {
    setActiveTab(value);
    if (value && value !== 'overview') {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      router.replace(pathname, { scroll: false });
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('pageTitle')}</Title>
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
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconDatabase size={16} />}>
              {t('tabOverview')}
            </Tabs.Tab>
            <Tabs.Tab value="breakdown" leftSection={<IconChartPie size={16} />}>
              {t('tabBreakdown')}
            </Tabs.Tab>
            <Tabs.Tab value="files" leftSection={<IconFile size={16} />}>
              {t('tabLargestFiles')}
            </Tabs.Tab>
            <Tabs.Tab value="alerts" leftSection={<IconAlertTriangle size={16} />}>
              {t('tabAlerts')}
            </Tabs.Tab>
            {isSuperAdmin && (
              <Tabs.Tab value="cache" leftSection={<IconCloud size={16} />}>
                {t('tabCache')}
              </Tabs.Tab>
            )}
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

          {isSuperAdmin && (
            <Tabs.Panel value="cache" pt="md" px="md" pb="md">
              <StorageManager />
            </Tabs.Panel>
          )}
        </Tabs>
      </div>
    </>
  );
}
