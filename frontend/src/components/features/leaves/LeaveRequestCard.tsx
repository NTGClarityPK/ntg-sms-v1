'use client';

import { Badge, Card, Group, Stack, Text, Button } from '@mantine/core';
import type { LeaveRequest } from '@/types/leaves';
import { useUpdateLeaveStatus } from '@/hooks/useLeaveRequests';

interface LeaveRequestCardProps {
  request: LeaveRequest;
  isStaffView?: boolean;
}

const statusColorMap: Record<LeaveRequest['status'], string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

export function LeaveRequestCard({
  request,
  isStaffView = false,
}: LeaveRequestCardProps) {
  const updateStatus = useUpdateLeaveStatus();

  const canReview = isStaffView && request.status === 'pending';
  const canCancel = !isStaffView && request.status === 'pending';

  const handleAction = (action: 'approve' | 'reject' | 'cancel') => {
    updateStatus.mutate({
      id: request.id,
      action,
    });
  };

  return (
    <Card withBorder p="md">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>
            {request.startDate} – {request.endDate}
          </Text>
          <Badge
            variant="light"
            color={statusColorMap[request.status] ?? 'gray'}
          >
            {request.status}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          {request.reason}
        </Text>
        <Group justify="flex-end" gap="xs" mt="xs">
          {canCancel && (
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => handleAction('cancel')}
              loading={updateStatus.isPending}
            >
              Cancel
            </Button>
          )}
          {canReview && (
            <>
              <Button
                size="xs"
                variant="light"
                color="green"
                onClick={() => handleAction('approve')}
                loading={updateStatus.isPending}
              >
                Approve
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={() => handleAction('reject')}
                loading={updateStatus.isPending}
              >
                Reject
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Card>
  );
}


