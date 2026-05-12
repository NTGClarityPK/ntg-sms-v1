'use client';

import { useTranslations } from 'next-intl';
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
  absent: 'red',
};

/** Format date string. Parses YYYY-MM-DD as local date to avoid timezone shift. */
const formatDate = (dateString: string): string => {
  const s = dateString.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateRange = (startDate: string, endDate: string): string => {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

export function LeaveRequestCard({
  request,
  isStaffView = false,
  studentName,
}: LeaveRequestCardProps) {
  const t = useTranslations('leave');
  const updateStatus = useUpdateLeaveStatus();

  const canReview = isStaffView && request.status === 'pending';
  const canCancel = !isStaffView && request.status === 'pending';

  const handleAction = (action: 'approve' | 'reject' | 'cancel') => {
    updateStatus.mutate({
      id: request.id,
      action,
    });
  };

  const statusBadge =
    request.status === 'absent' ? (
      <Badge variant="filled" color="red" tt="uppercase" size="sm">
        {t('absent')}
      </Badge>
    ) : (
      <Badge variant="light" color={statusColorMap[request.status] ?? 'gray'}>
        {t(request.status)}
      </Badge>
    );

  return (
    <Card withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                {t('dateRequested')}
              </Text>
              <Text size="sm" fw={500}>
                {formatDate(request.createdAt)}
              </Text>
            </div>
            
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                {t('leavePeriod')}
              </Text>
              <Text size="sm" fw={500}>
                {formatDateRange(request.startDate, request.endDate)}
              </Text>
            </div>
            
            {studentName && (
              <div>
                <Text size="xs" c="dimmed" fw={500} mb={4}>
                  {t('student')}
                </Text>
                <Text size="sm" fw={500}>
                  {studentName}
                </Text>
              </div>
            )}
            
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                {t('reason')}
              </Text>
              <Text size="sm">
                {request.reason}
              </Text>
            </div>
          </Stack>
          
          <div>
            {request.status === 'pending' ? (
              <Tooltip label={t('pendingFromTeacher')} withArrow>
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
              {t('cancel')}
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
                {t('approve')}
              </Button>
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={() => handleAction('reject')}
                loading={updateStatus.isPending}
              >
                {t('reject')}
              </Button>
            </>
          )}
        </Group>
      </Stack>
    </Card>
  );
}


