'use client';

import { useState } from 'react';
import { Group, Title, Tabs } from '@mantine/core';
import { IconCalendarCheck, IconHistory, IconUserCheck } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeaturePermission } from '@/hooks/usePermissions';
import type { User } from '@/types/auth';
import { AttendanceHistoryContent } from '@/components/features/attendance/AttendanceHistoryContent';
import { MarkAttendanceContent } from '@/components/features/attendance/MarkAttendanceContent';
import { ChildAttendanceContent } from '@/components/features/attendance/ChildAttendanceContent';

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<string | null>('history');
  const { user } = useAuth();
  const { canEdit } = useFeaturePermission('attendance');
  const userTyped = user as User | undefined;
  const isTeacher = userTyped?.roles?.some(
    (r) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher',
  );
  const isParent = userTyped?.roles?.some((r) => r.roleName === 'parent');

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Attendance</Title>
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
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
              History
            </Tabs.Tab>
            {isTeacher && canEdit && (
              <Tabs.Tab value="mark" leftSection={<IconCalendarCheck size={16} />}>
                Mark Attendance
              </Tabs.Tab>
            )}
            {isParent && (
              <Tabs.Tab value="child" leftSection={<IconUserCheck size={16} />}>
                Child Attendance
              </Tabs.Tab>
            )}
          </Tabs.List>

          <Tabs.Panel value="history" pt="md" px="md" pb="md">
            <AttendanceHistoryContent />
          </Tabs.Panel>

          {isTeacher && canEdit && (
            <Tabs.Panel value="mark" pt="md" px="md" pb="md">
              <MarkAttendanceContent />
            </Tabs.Panel>
          )}

          {isParent && (
            <Tabs.Panel value="child" pt="md" px="md" pb="md">
              <ChildAttendanceContent />
            </Tabs.Panel>
          )}
        </Tabs>
      </div>
    </>
  );
}
