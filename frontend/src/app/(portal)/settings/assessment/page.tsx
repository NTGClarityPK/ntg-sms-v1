'use client';

import { Group, Tabs, Title } from '@mantine/core';
import { AssessmentTypeList } from '@/components/features/settings/AssessmentTypeList';
import { GradeTemplateBuilder } from '@/components/features/settings/GradeTemplateBuilder';
import { GradeTemplateAssignment } from '@/components/features/settings/GradeTemplateAssignment';
import { LeaveQuotaSetting } from '@/components/features/settings/LeaveQuotaSetting';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';

export default function AssessmentSettingsPage() {
  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Assessment Settings</Title>
        </Group>
      </div>

      <Tabs defaultValue="types">
        <Tabs.List>
          <Tabs.Tab value="types">Assessment types</Tabs.Tab>
          <Tabs.Tab value="templates">Grade templates</Tabs.Tab>
          <Tabs.Tab value="assignments">Assignments</Tabs.Tab>
          <Tabs.Tab value="leave">Leave quota</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="types" pt="md" px="md" pb="md">
          <AssessmentTypeList />
        </Tabs.Panel>
        <Tabs.Panel value="templates" pt="md" px="md" pb="md">
          <GradeTemplateBuilder />
        </Tabs.Panel>
        <Tabs.Panel value="assignments" pt="md" px="md" pb="md">
          <GradeTemplateAssignment />
        </Tabs.Panel>
        <Tabs.Panel value="leave" pt="md" px="md" pb="md">
          <LeaveQuotaSetting academicYearId={activeYearId} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}


