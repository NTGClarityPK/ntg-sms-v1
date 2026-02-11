'use client';

import { Group, Title, Text, Card, Stack, Button } from '@mantine/core';
import { IconUser, IconUsersGroup } from '@tabler/icons-react';
import Link from 'next/link';

export default function ReportsPage() {
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Reports</Title>
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
          <Card withBorder p="lg">
            <Stack gap="md">
              <Title order={3}>Student report</Title>
              <Text c="dimmed" size="sm">
                View a full report for a student (academic, attendance, behavioral). Select a student from the Students page or use the link below with a student ID.
              </Text>
              <Button
                component={Link}
                href="/reports/student"
                leftSection={<IconUser size={18} />}
                variant="light"
              >
                Open student report
              </Button>
            </Stack>
          </Card>

          <Card withBorder p="lg">
            <Stack gap="md">
              <Title order={3}>Class report</Title>
              <Text c="dimmed" size="sm">
                View performance and attendance summary for a class section. Select a class section to see the report.
              </Text>
              <Button
                component={Link}
                href="/reports/class"
                leftSection={<IconUsersGroup size={18} />}
                variant="light"
              >
                Open class report
              </Button>
            </Stack>
          </Card>
        </Stack>
      </div>
    </>
  );
}
