'use client';

import { Group, Title, Stack, SimpleGrid } from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import { AttendanceWidget } from '@/components/features/dashboard/AttendanceWidget';
import { ChildAttendanceWidget } from '@/components/features/dashboard/ChildAttendanceWidget';
import type { User } from '@/types/auth';

export default function DashboardPage() {
  const { user } = useAuth();
  const userTyped = user as User | undefined;

  const isTeacher = userTyped?.roles?.some(
    (r) => r.roleName === 'class_teacher' || r.roleName === 'subject_teacher',
  );
  const isParent = userTyped?.roles?.some((r) => r.roleName === 'parent');

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Dashboard</Title>
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
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {isTeacher && <AttendanceWidget />}
            {isParent && <ChildAttendanceWidget />}
          </SimpleGrid>
        </Stack>
      </div>
    </>
  );
}

