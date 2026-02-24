'use client';

import { useMemo, useState } from 'react';
import {
  Group,
  Title,
  Stack,
  Paper,
  Text,
  Skeleton,
  Tabs,
  Table,
  Badge,
  Button,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useUniformRequests } from '@/hooks/useUniformRequests';
import { apiClient } from '@/lib/api-client';
import { RequestForm } from '@/components/features/inventory/RequestForm';
import type { User } from '@/types/auth';
import type { UniformRequest } from '@/types/inventory';

interface ParentChild {
  studentId: string;
  studentName?: string;
  studentStudentId?: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'yellow',
  approved: 'blue',
  rejected: 'red',
  issued: 'green',
  cancelled: 'gray',
};

function formatItemsSummary(items: UniformRequest['items']): string {
  return items
    .map(
      (i) =>
        `${i.uniformItemName ?? i.uniformItemId} — ${i.size} × ${i.quantity}`,
    )
    .join(', ');
}

export default function UniformRequestPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const userId = (user as User | undefined)?.id;
  const [activeTab, setActiveTab] = useState<string | null>('request');
  const [historyPage, setHistoryPage] = useState(1);

  const { data: childrenData, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['parent-children', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.get<ParentChild[]>(
        `/api/v1/parents/${userId}/children`,
      );
      return response.data ?? [];
    },
    enabled: !!userId && !!isParent,
  });

  const { data: studentsData, isLoading: isLoadingStudents } = useStudents({
    page: 1,
    limit: 500,
  });

  const requestsQuery = useUniformRequests({
    page: historyPage,
    limit: 20,
  });

  const children = Array.isArray(childrenData) ? childrenData : [];
  const studentsFromApi = studentsData?.data ?? [];

  const studentOptions = useMemo(() => {
    if (isParent && children.length > 0) {
      return children.map((c) => ({
        value: c.studentId,
        label: c.studentName ?? c.studentStudentId ?? c.studentId,
      }));
    }
    return studentsFromApi.map((s) => ({
      value: s.id,
      label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || s.id,
    }));
  }, [isParent, children, studentsFromApi]);

  const isLoading =
    (isParent && isLoadingChildren) || (!isParent && isLoadingStudents);

  const requestsResponse = requestsQuery.data as
    | { data?: UniformRequest[]; meta?: { total: number; totalPages: number } }
    | null
    | undefined;
  const requests = requestsResponse?.data ?? [];
  const historyMeta = requestsResponse?.meta;
  const isLoadingHistory =
    requestsQuery.isLoading || requestsQuery.isRefetching || !requestsQuery.data;
  const isEmptyHistory = !isLoadingHistory && requests.length === 0;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Request uniform</Title>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              size="lg"
              loading={requestsQuery.isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['uniform-requests'] })}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
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
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="request">Request</Tabs.Tab>
            <Tabs.Tab value="history">View History</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="request" pt="md">
            <Stack gap="md">
              <Paper p="lg" withBorder>
                <Text size="sm" c="dimmed" mb="md">
                  Submit a uniform request for a student. An admin will review
                  and issue the items.
                </Text>
                {isLoading ? (
                  <Skeleton height={200} />
                ) : studentOptions.length === 0 ? (
                  <Text c="dimmed">
                    No students available. Parents can only request for their
                    linked children.
                  </Text>
                ) : (
                  <RequestForm studentOptions={studentOptions} />
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Text fw={600} mb="sm">
                  Your past requests
                </Text>
                {isLoadingHistory ? (
                  <Skeleton height={200} />
                ) : isEmptyHistory ? (
                  <Text size="sm" c="dimmed">
                    No requests yet. Use the Request tab to submit a uniform
                    request.
                  </Text>
                ) : (
                  <>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Student</Table.Th>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Items</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {requests.map((req) => (
                          <Table.Tr key={req.id}>
                            <Table.Td>
                              <Text size="sm" fw={500}>
                                {req.studentName ?? req.studentId}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {new Date(req.createdAt).toLocaleDateString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                size="sm"
                                color={STATUS_COLOR[req.status] ?? 'gray'}
                              >
                                {req.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatItemsSummary(req.items)}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    {historyMeta && historyMeta.totalPages > 1 && (
                      <Group justify="center" gap="xs" mt="md">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={historyPage <= 1}
                          onClick={() =>
                            setHistoryPage((p) => Math.max(1, p - 1))
                          }
                        >
                          Previous
                        </Button>
                        <Text size="sm" c="dimmed">
                          Page {historyPage} of {historyMeta.totalPages}
                        </Text>
                        <Button
                          variant="default"
                          size="sm"
                          disabled={historyPage >= historyMeta.totalPages}
                          onClick={() => setHistoryPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </Group>
                    )}
                  </>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
