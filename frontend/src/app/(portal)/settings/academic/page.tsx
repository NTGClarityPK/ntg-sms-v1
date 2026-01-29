'use client';

import { Group, Tabs, Title } from '@mantine/core';
import { SubjectList } from '@/components/features/settings/SubjectList';
import { ClassList } from '@/components/features/settings/ClassList';
import { SectionList } from '@/components/features/settings/SectionList';
import { LevelManager } from '@/components/features/settings/LevelManager';

export default function AcademicSettingsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Academic Settings</Title>
        </Group>
      </div>

      <Tabs defaultValue="subjects">
        <Tabs.List>
          <Tabs.Tab value="subjects">Subjects</Tabs.Tab>
          <Tabs.Tab value="classes">Classes</Tabs.Tab>
          <Tabs.Tab value="sections">Sections</Tabs.Tab>
          <Tabs.Tab value="levels">Levels</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="subjects" pt="md" px="md" pb="md">
          <SubjectList />
        </Tabs.Panel>
        <Tabs.Panel value="classes" pt="md" px="md" pb="md">
          <ClassList />
        </Tabs.Panel>
        <Tabs.Panel value="sections" pt="md" px="md" pb="md">
          <SectionList />
        </Tabs.Panel>
        <Tabs.Panel value="levels" pt="md" px="md" pb="md">
          <LevelManager />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}


