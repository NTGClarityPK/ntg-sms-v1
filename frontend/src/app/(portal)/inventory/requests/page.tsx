'use client';

import { useState, useMemo } from 'react';
import {
  Group,
  Title,
  Stack,
  Skeleton,
  Select,
  Paper,
  Text,
  Button,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconX, IconTruck, IconTrash, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  useUniformRequests,
  useApproveUniformRequest,
  useRejectUniformRequest,
  useIssueUniformRequest,
  useCancelUniformRequest,
} from '@/hooks/useUniformRequests';
import { useAuth } from '@/hooks/useAuth';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { ApprovalModal } from '@/components/features/inventory/ApprovalModal';
import { IssueModal } from '@/components/features/inventory/IssueModal';
import type { UniformRequest } from '@/types/inventory';

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

export default function InventoryRequestsPage() {
  const t = useTranslations('inventory');
  const STATUS_OPTIONS = useMemo(
    () => [
      { value: 'pending', label: t('pending') },
      { value: 'approved', label: t('approved') },
      { value: 'rejected', label: t('rejected') },
      { value: 'issued', label: t('issued') },
      { value: 'cancelled', label: t('cancelled') },
    ],
    [t],
  );

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canEdit } = useFeaturePermission('inventory');
  const currentUserId = user?.id;
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UniformRequest | null>(
    null,
  );

  const requestsQuery = useUniformRequests({
    page,
    limit: 20,
    status: statusFilter ? [statusFilter as UniformRequest['status']] : undefined,
  });
  const approveMutation = useApproveUniformRequest();
  const rejectMutation = useRejectUniformRequest();
  const issueMutation = useIssueUniformRequest();
  const cancelMutation = useCancelUniformRequest();

  const response = requestsQuery.data as
    | { data?: UniformRequest[]; meta?: { total: number; totalPages: number } }
    | null
    | undefined;
  const requests = response?.data ?? [];
  const meta = response?.meta;
  const isLoading = requestsQuery.isLoading || requestsQuery.isRefetching || !requestsQuery.data;
  const isEmpty = !isLoading && requests.length === 0;

  const handleApprove = (req: UniformRequest) => {
    setSelectedRequest(req);
    setApproveModalOpen(true);
  };
  const handleReject = (req: UniformRequest) => {
    setSelectedRequest(req);
    setRejectModalOpen(true);
  };
  const handleIssue = (req: UniformRequest) => {
    setSelectedRequest(req);
    setIssueModalOpen(true);
  };
  const handleCancel = (req: UniformRequest) => {
    cancelMutation.mutate(req.id);
  };

  const handleApproveConfirm = (id: string, notes?: string) => {
    approveMutation.mutate(
      { id, notes },
      {
        onSuccess: () => {
          setApproveModalOpen(false);
          setSelectedRequest(null);
        },
      },
    );
  };
  const handleRejectConfirm = (id: string, notes?: string) => {
    rejectMutation.mutate(
      { id, notes },
      {
        onSuccess: () => {
          setRejectModalOpen(false);
          setSelectedRequest(null);
        },
      },
    );
  };
  const handleIssueConfirm = (id: string) => {
    issueMutation.mutate(id, {
      onSuccess: () => {
        setIssueModalOpen(false);
        setSelectedRequest(null);
      },
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('uniformRequestsTitle')}</Title>
          <Tooltip label={t('refresh')}>
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
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Select
              id="inventory-requests-filter-status"
              label={t('status')}
              placeholder={t('allStatuses')}
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              clearable
            />
          </Paper>

          {isLoading ? (
            <Skeleton height={320} />
          ) : isEmpty ? (
            <Paper p="xl" withBorder>
              <Text c="dimmed" ta="center">
                {t('noRequestsFound')}
              </Text>
            </Paper>
          ) : (
            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('student')}</Table.Th>
                    <Table.Th>{t('requestedBy')}</Table.Th>
                    <Table.Th>{t('date')}</Table.Th>
                    <Table.Th>{t('status')}</Table.Th>
                    <Table.Th>{t('notes')}</Table.Th>
                    <Table.Th>{t('items')}</Table.Th>
                    <Table.Th>{t('actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {requests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const canCancel = isPending && req.requestedBy === currentUserId;
                    const hasActions = canEdit || canCancel;
                    return (
                      <Table.Tr key={req.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {req.studentName ?? req.studentId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {req.requesterName ?? req.requestedBy}
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
                            {t(req.status)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" lineClamp={2}>
                            {req.notes ?? '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatItemsSummary(req.items)}</Text>
                        </Table.Td>
                        <Table.Td>
                          {hasActions ? (
                            <Group gap="xs">
                              {canEdit && isPending && (
                                <>
                                  <ActionIcon
                                    variant="light"
                                    color="green"
                                    title={t('approve')}
                                    onClick={() => handleApprove(req)}
                                  >
                                    <IconCheck size={16} />
                                  </ActionIcon>
                                  <ActionIcon
                                    variant="light"
                                    color="red"
                                    title={t('reject')}
                                    onClick={() => handleReject(req)}
                                  >
                                    <IconX size={16} />
                                  </ActionIcon>
                                </>
                              )}
                              {canEdit && isApproved && (
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  title={t('markIssued')}
                                  onClick={() => handleIssue(req)}
                                >
                                  <IconTruck size={16} />
                                </ActionIcon>
                              )}
                              {canCancel && (
                                <ActionIcon
                                  variant="light"
                                  color="gray"
                                  title={t('cancelRequest')}
                                  onClick={() => handleCancel(req)}
                                >
                                  <IconTrash size={16} />
                                </ActionIcon>
                              )}
                            </Group>
                          ) : (
                            '—'
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {meta && meta.totalPages > 1 && (
            <Group justify="center" gap="xs">
              <Button
                variant="default"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('previous')}
              </Button>
              <Text size="sm" c="dimmed">
                {t('pageOf', { page, total: meta.totalPages })}
              </Text>
              <Button
                variant="default"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
              </Button>
            </Group>
          )}
        </Stack>
      </div>

      <ApprovalModal
        opened={approveModalOpen}
        onClose={() => {
          setApproveModalOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        mode="approve"
        onConfirm={handleApproveConfirm}
        isPending={approveMutation.isPending}
      />
      <ApprovalModal
        opened={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        mode="reject"
        onConfirm={handleRejectConfirm}
        isPending={rejectMutation.isPending}
      />
      <IssueModal
        opened={issueModalOpen}
        onClose={() => {
          setIssueModalOpen(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onConfirm={handleIssueConfirm}
        isPending={issueMutation.isPending}
      />
    </>
  );
}
