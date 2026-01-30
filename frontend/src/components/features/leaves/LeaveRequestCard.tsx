'use client';

import { Badge, Card, Group, Stack, Text, Button, Tooltip } from '@mantine/core';
import type { LeaveRequest } from '@/types/leaves';
import { useUpdateLeaveStatus } from '@/hooks/useLeaveRequests';

interface LeaveRequestCardProps {
  request: LeaveRequest;
  isStaffView?: boolean;
  studentName?: string; // Optional student name to display
}

const statusColorMap: Record<LeaveRequest['status'], string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // If same date, show once
  if (start.toDateString() === end.toDateString()) {
    return formatDate(startDate);
  }
  
  // Otherwise show range
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

export function LeaveRequestCard({
  request,
  isStaffView = false,
  studentName,
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

  const statusBadge = (
    <Badge
      variant="light"
      color={statusColorMap[request.status] ?? 'gray'}
    >
      {request.status}
    </Badge>
  );

  return (
    <Card withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                Date Requested
              </Text>
              <Text size="sm" fw={500}>
                {formatDate(request.createdAt)}
              </Text>
            </div>
            
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                Leave Period
              </Text>
              <Text size="sm" fw={500}>
                {formatDateRange(request.startDate, request.endDate)}
              </Text>
            </div>
            
            {studentName && (
              <div>
                <Text size="xs" c="dimmed" fw={500} mb={4}>
                  Student
                </Text>
                <Text size="sm" fw={500}>
                  {studentName}
                </Text>
              </div>
            )}
            
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                Reason
              </Text>
              <Text size="sm">
                {request.reason}
              </Text>
            </div>
          </Stack>
          
          <div>
            {request.status === 'pending' ? (
              <Tooltip label="Pending from teacher's end" withArrow>
                {statusBadge}
              </Tooltip>
            ) : (
              statusBadge
            )}
          </div>
        </Group>
        
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


