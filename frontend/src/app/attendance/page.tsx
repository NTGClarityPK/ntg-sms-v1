'use client';

import { Group, Title, Button, Card, Stack, Text } from '@mantine/core';
import { IconCalendarCheck, IconHistory, IconUserCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';

export default function AttendancePage() {
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
          <Title order={1}>Attendance</Title>
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
          {isTeacher && (
            <Card withBorder p="lg">
              <Stack gap="md">
                <Title order={3}>Mark Attendance</Title>
                <Text c="dimmed" size="sm">
                  Mark daily attendance for your class-sections
                </Text>
                <Button
                  component={Link}
                  href="/attendance/mark"
                  leftSection={<IconCalendarCheck size={18} />}
                >
                  Mark Attendance
                </Button>
              </Stack>
            </Card>
          )}

          <Card withBorder p="lg">
            <Stack gap="md">
              <Title order={3}>View History</Title>
              <Text c="dimmed" size="sm">
                View attendance history and generate reports
              </Text>
              <Button
                component={Link}
                href="/attendance/history"
                leftSection={<IconHistory size={18} />}
                variant="light"
              >
                View History
              </Button>
            </Stack>
          </Card>

          {isParent && (
            <Card withBorder p="lg">
              <Stack gap="md">
                <Title order={3}>Child Attendance</Title>
                <Text c="dimmed" size="sm">
                  View your child&apos;s attendance records
                </Text>
                <Button
                  component={Link}
                  href="/attendance/child"
                  leftSection={<IconUserCheck size={18} />}
                  variant="light"
                >
                  View Child Attendance
                </Button>
              </Stack>
            </Card>
          )}
        </Stack>
      </div>
    </>
  );
}

