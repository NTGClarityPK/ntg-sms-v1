'use client';

import { Badge, Card, Group, Stack, Text, Button } from '@mantine/core';
import type { EarlyDepartureRequest } from '@/types/early-departure';
import { useUpdateEarlyDepartureStatus } from '@/hooks/useEarlyDepartures';

interface EarlyDepartureCardProps {
  request: EarlyDepartureRequest;
  isStaffView?: boolean;
}

const statusColorMap: Record<EarlyDepartureRequest['status'], string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
};

export function EarlyDepartureCard({
  request,
  isStaffView = false,
}: EarlyDepartureCardProps) {
  const updateStatus = useUpdateEarlyDepartureStatus();

  const canReview = isStaffView && request.status === 'pending';

  const handleAction = (action: 'approve' | 'reject') => {
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
            {request.date} – {request.departureTime}
          </Text>
          <Badge
            variant="light"
            color={statusColorMap[request.status] ?? 'gray'}
          >
            {request.status}
          </Badge>
        </Group>
        {request.reason && (
          <Text size="sm" c="dimmed">
            {request.reason}
          </Text>
        )}
        <Group justify="flex-end" gap="xs" mt="xs">
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


