'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Alert, Anchor, Group, Tabs, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { AssessmentTypeList } from '@/components/features/settings/AssessmentTypeList';
import { GradeTemplateBuilder } from '@/components/features/settings/GradeTemplateBuilder';

export default function AssessmentSettingsPage() {
  const tSettings = useTranslations('settings');

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Assessment Settings</Title>
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
        <Alert
          icon={<IconInfoCircle size={18} />}
          color="blue"
          mb="md"
          title={tSettings('assessmentStandaloneLeaveQuotaTitle')}
        >
          {tSettings('assessmentStandaloneLeaveQuotaBody')}{' '}
          <Anchor component={Link} href="/settings" id="assessment-settings-link-main-settings">
            {tSettings('assessmentStandaloneLeaveQuotaLink')}
          </Anchor>
        </Alert>

        <Tabs defaultValue="types">
          <Tabs.List>
            <Tabs.Tab value="types">Assessment types</Tabs.Tab>
            <Tabs.Tab value="templates">Grade templates</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="types" pt="md" px="md" pb="md">
            <AssessmentTypeList />
          </Tabs.Panel>
          <Tabs.Panel value="templates" pt="md" px="md" pb="md">
            <GradeTemplateBuilder />
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}


