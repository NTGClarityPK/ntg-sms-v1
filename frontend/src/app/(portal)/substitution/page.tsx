'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Group, Title, Tabs } from '@mantine/core';
import { IconHistory, IconUserPlus } from '@tabler/icons-react';
import { SubstitutionDashboardContent } from '@/components/features/substitutions/SubstitutionDashboardContent';
import { SubstitutionHistoryContent } from '@/components/features/substitutions/SubstitutionHistoryContent';

export default function SubstitutionPage() {
  const t = useTranslations('substitution');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('substitute');

  useEffect(() => {
    if (searchParams?.get('tab') === 'history') {
      setActiveTab('history');
    }
  }, [searchParams]);

  const handleTabChange = (value: string | null) => {
    const tab = value ?? 'substitute';
    setActiveTab(tab);
    if (tab === 'history') {
      router.replace('/substitution?tab=history', { scroll: false });
    } else if (searchParams?.get('tab')) {
      router.replace('/substitution', { scroll: false });
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
        </Group>
      </div>
      <div className="page-sub-title-bar" />
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
            <Tabs.Tab
              value="substitute"
              id="substitution-tab-substitute"
              leftSection={<IconUserPlus size={16} />}
            >
              {t('substituteTab')}
            </Tabs.Tab>
            <Tabs.Tab
              value="history"
              id="substitution-tab-history"
              leftSection={<IconHistory size={16} />}
            >
              {t('historyTab')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="substitute" pt="md">
            <SubstitutionDashboardContent />
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            <SubstitutionHistoryContent />
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
