'use client';

import { Card, Text, Group, Badge, Stack, Button } from '@mantine/core';
import type { UniformRequest } from '@/types/inventory';

interface RequestCardProps {
  request: UniformRequest;
  onApprove?: (request: UniformRequest) => void;
  onReject?: (request: UniformRequest) => void;
  onIssue?: (request: UniformRequest) => void;
  onCancel?: (request: UniformRequest) => void;
  canManage?: boolean;
  /** True if current user is the requestor (e.g. parent) and can cancel own pending request */
  canCancel?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'yellow',
  approved: 'blue',
  rejected: 'red',
  issued: 'green',
  cancelled: 'gray',
};

export function RequestCard({
  request,
  onApprove,
  onReject,
  onIssue,
  onCancel,
  canManage,
  canCancel,
}: RequestCardProps) {
  const isPending = request.status === 'pending';
  const isApproved = request.status === 'approved';
  const showCancel = isPending && (canCancel ?? false);

  return (
    <Card shadow="sm" padding="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text fw={600}>{request.studentName ?? request.studentId}</Text>
            <Text size="xs" c="dimmed">
              Requested by {request.requesterName ?? request.requestedBy} ·{' '}
              {new Date(request.createdAt).toLocaleDateString()}
            </Text>
          </div>
          <Badge color={STATUS_COLOR[request.status] ?? 'gray'}>
            {request.status}
          </Badge>
        </Group>
        {request.notes && (
          <Text size="sm" c="dimmed">
            {request.notes}
          </Text>
        )}
        <div>
          <Text size="sm" fw={500} mb={4}>
            Items
          </Text>
          <Stack gap={2}>
            {request.items.map((item) => (
              <Text key={item.id} size="sm">
                {item.uniformItemName ?? item.uniformItemId} — {item.size} ×{' '}
                {item.quantity}
              </Text>
            ))}
          </Stack>
        </div>
        {(canManage || showCancel) && (
          <Group gap="xs">
            {canManage && isPending && (
              <>
                <Button
                  size="xs"
                  variant="light"
                  color="green"
                  onClick={() => onApprove?.(request)}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  onClick={() => onReject?.(request)}
                >
                  Reject
                </Button>
              </>
            )}
            {showCancel && (
              <Button
                size="xs"
                variant="default"
                onClick={() => onCancel?.(request)}
              >
                Cancel
              </Button>
            )}
            {canManage && isApproved && (
              <Button
                size="xs"
                variant="light"
                color="blue"
                onClick={() => onIssue?.(request)}
              >
                Mark issued
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
