'use client';

import { Group, Title, Text, Card, Stack, Button, Skeleton } from '@mantine/core';
import { IconTable } from '@tabler/icons-react';
import Link from 'next/link';
import { usePendingBehavioral } from '@/hooks/useBehavioral';

export default function BehavioralPage() {
  const pendingQuery = usePendingBehavioral();
  const pending = pendingQuery.data ?? [];
  const isLoading = pendingQuery.isLoading || !pendingQuery.data;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Behavioral Assessment</Title>
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
              <Title order={3}>Assess by class</Title>
              <Text c="dimmed" size="sm">
                Open the matrix view to enter star ratings for all students in a class section for a given month.
              </Text>
              <Button
                component={Link}
                href="/behavioral/assess"
                leftSection={<IconTable size={18} />}
              >
                Open matrix
              </Button>
            </Stack>
          </Card>

          <Card withBorder p="lg">
            <Stack gap="md">
              <Title order={3}>Pending this month</Title>
              <Text c="dimmed" size="sm">
                Students in your class sections who have not been assessed yet this month.
              </Text>
              {isLoading ? (
                <Skeleton height={80} radius="sm" />
              ) : pending.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No pending students, or you are not assigned to any class section.
                </Text>
              ) : (
                <Stack gap="xs">
                  {pending.slice(0, 10).map((s) => (
                    <Text key={s.id} size="sm">
                      {s.fullName}
                      {s.className || s.sectionName
                        ? ` (${[s.className, s.sectionName].filter(Boolean).join(' ')})`
                        : ''}
                    </Text>
                  ))}
                  {pending.length > 10 && (
                    <Text size="sm" c="dimmed">
                      +{pending.length - 10} more
                    </Text>
                  )}
                </Stack>
              )}
            </Stack>
          </Card>
        </Stack>
      </div>
    </>
  );
}
