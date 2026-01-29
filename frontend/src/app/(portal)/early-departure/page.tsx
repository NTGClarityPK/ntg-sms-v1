'use client';

import { useState } from 'react';
import {
  Card,
  Group,
  Stack,
  Title,
  Tabs,
  SimpleGrid,
  Text,
} from '@mantine/core';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { EarlyDepartureForm } from '@/components/features/early-departure/EarlyDepartureForm';
import { EarlyDepartureCard } from '@/components/features/early-departure/EarlyDepartureCard';

export default function EarlyDeparturePage() {
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const [page] = useState(1);

  const studentsQuery = useStudents({
    page: 1,
    limit: 100,
  });

  const firstStudent = studentsQuery.data?.data?.[0] ?? null;

  const requestsQuery = useEarlyDepartures({
    page,
    limit: 20,
  });

  const requests = requestsQuery.data?.data ?? [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Early Departure</Title>
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
        <Tabs defaultValue={isParent ? 'my-requests' : 'all-requests'}>
          <Tabs.List>
            {isParent && (
              <Tabs.Tab value="my-requests">My requests</Tabs.Tab>
            )}
            <Tabs.Tab value="all-requests">All requests</Tabs.Tab>
          </Tabs.List>

          {isParent && (
            <Tabs.Panel value="my-requests" pt="md">
              <Stack gap="md">
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Title order={3}>Request early departure</Title>
                    {firstStudent ? (
                      <EarlyDepartureForm student={firstStudent} />
                    ) : (
                      <Text size="sm" c="dimmed">
                        No student found for your account.
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="all-requests" pt="md">
            <Stack gap="md">
              {requests.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No early departure requests found.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  {requests.map((r) => (
                    <EarlyDepartureCard
                      key={r.id}
                      request={r}
                      isStaffView={!isParent}
                    />
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}


