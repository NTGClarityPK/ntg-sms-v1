'use client';

import { Alert, Tabs, Title, Text } from '@mantine/core';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/usePermissions';
import { ParentStudentMappingTab } from '@/components/features/mapping/ParentStudentMappingTab';
import { TeacherClassMappingTab } from '@/components/features/mapping/TeacherClassMappingTab';

type MappingTab = 'parent-student' | 'teacher-class';

export default function MappingPage() {
  const tNav = useTranslations('navigation');
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canView } = usePermissions();

  const canViewParentStudent = canView('parent_associations');
  const canViewTeacherClass = canView('teacher_mapping');

  const availableTabs = useMemo(() => {
    const tabs: MappingTab[] = [];
    if (canViewParentStudent) tabs.push('parent-student');
    if (canViewTeacherClass) tabs.push('teacher-class');
    return tabs;
  }, [canViewParentStudent, canViewTeacherClass]);

  const requested = (searchParams?.get('tab') as MappingTab | null) ?? null;
  const defaultTab: MappingTab | null =
    (requested && availableTabs.includes(requested) ? requested : null) ?? availableTabs[0] ?? null;

  if (!defaultTab) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{tNav('mapping')}</Title>
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
          <Alert color="red" title="Access denied">
            <Text size="sm">You do not have permission to view mapping pages.</Text>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{tNav('mapping')}</Title>
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
        <Tabs
          id="mapping-tabs"
          value={defaultTab}
          onChange={(value) => {
            const next = (value as MappingTab | null) ?? defaultTab;
            router.replace(`/mapping?tab=${next}`);
          }}
          keepMounted={false}
        >
          <Tabs.List>
            {canViewParentStudent && (
              <Tabs.Tab id="mapping-tab-parent-student" value="parent-student">
                Parent–Student
              </Tabs.Tab>
            )}
            {canViewTeacherClass && (
              <Tabs.Tab id="mapping-tab-teacher-class" value="teacher-class">
                Teacher–Class
              </Tabs.Tab>
            )}
          </Tabs.List>

          {canViewParentStudent && (
            <Tabs.Panel value="parent-student" pt="md">
              <ParentStudentMappingTab />
            </Tabs.Panel>
          )}

          {canViewTeacherClass && (
            <Tabs.Panel value="teacher-class" pt="md">
              <TeacherClassMappingTab />
            </Tabs.Panel>
          )}
        </Tabs>
      </div>
    </>
  );
}

