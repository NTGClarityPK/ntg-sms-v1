'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Stack, Tabs, Title } from '@mantine/core';
import { CertificateIssueWizard } from '@/components/features/certificates/CertificateIssueWizard';
import { CertificateHistoryTable } from '@/components/features/certificates/CertificateHistoryTable';
import { CertificateSettingsForm } from '@/components/features/certificates/CertificateSettingsForm';
import { usePermissions } from '@/hooks/usePermissions';

function resolveInitialTab(tabParam: string | null): string {
  if (tabParam === 'history') return 'history';
  if (tabParam === 'settings') return 'settings';
  return 'issue';
}

export default function CertificatesPage() {
  const t = useTranslations('certificates');
  const searchParams = useSearchParams();
  const initialTab = resolveInitialTab(searchParams?.get('tab') ?? null);
  const [tab, setTab] = useState<string | null>(initialTab);
  const { canEdit } = usePermissions();
  const canIssue = canEdit('certificates');
  const canManageSettings = canEdit('certificates');

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('title')}</Title>
      </div>
      <div style={{ marginTop: '60px', padding: 'var(--mantine-spacing-md)' }}>
        <Stack gap="md">
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List>
              <Tabs.Tab value="issue" id="cert-tab-issue">
                {t('tabs.issue')}
              </Tabs.Tab>
              <Tabs.Tab value="history" id="cert-tab-history">
                {t('tabs.history')}
              </Tabs.Tab>
              {canManageSettings && (
                <Tabs.Tab value="settings" id="cert-tab-settings">
                  {t('tabs.settings')}
                </Tabs.Tab>
              )}
            </Tabs.List>
            <Tabs.Panel value="issue" pt="md">
              {canIssue ? (
                tab === 'issue' ? (
                  <CertificateIssueWizard onIssued={() => setTab('history')} />
                ) : null
              ) : (
                <Alert color="yellow">{t('issue.noPermission')}</Alert>
              )}
            </Tabs.Panel>
            <Tabs.Panel value="history" pt="md">
              <CertificateHistoryTable mine={false} />
            </Tabs.Panel>
            {canManageSettings && (
              <Tabs.Panel value="settings" pt="md">
                {tab === 'settings' ? <CertificateSettingsForm /> : null}
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </div>
    </>
  );
}
