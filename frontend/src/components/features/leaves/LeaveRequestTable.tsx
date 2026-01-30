'use client';

import { Table, Badge, Group, Button, Pagination, Text, Tooltip, Modal, Textarea, Stack, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import type { LeaveRequest } from '@/types/leaves';
import { useUpdateLeaveStatus } from '@/hooks/useLeaveRequests';

interface LeaveRequestTableProps {
  requests: LeaveRequest[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  isStaffView?: boolean;
  studentNameMap?: Map<string, string>;
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
  
  if (start.toDateString() === end.toDateString()) {
    return formatDate(startDate);
  }
  
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
};

export function LeaveRequestTable({
  requests,
  meta,
  onPageChange,
  isStaffView = false,
  studentNameMap,
}: LeaveRequestTableProps) {
  const [reviewModalOpened, { open: openReviewModal, close: closeReviewModal }] = useDisclosure(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const updateStatus = useUpdateLeaveStatus();

  const handleReviewClick = (request: LeaveRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes('');
    openReviewModal();
  };

  const handleCancelClick = (request: LeaveRequest) => {
    updateStatus.mutate({
      id: request.id,
      action: 'cancel',
    });
  };

  const handleConfirmReview = () => {
    if (!selectedRequest || !reviewAction) return;

    updateStatus.mutate(
      {
        id: selectedRequest.id,
        action: reviewAction,
        reviewNotes: reviewNotes.trim() || undefined,
      },
      {
        onSuccess: () => {
          closeReviewModal();
          setSelectedRequest(null);
          setReviewAction(null);
          setReviewNotes('');
        },
      },
    );
  };

  const statusBadge = (status: LeaveRequest['status']) => {
    const badge = (
      <Badge variant="light" color={statusColorMap[status] ?? 'gray'}>
        {status}
      </Badge>
    );

    if (status === 'pending') {
      return (
        <Tooltip label="Pending from teacher's end" withArrow>
          {badge}
        </Tooltip>
      );
    }

    return badge;
  };

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date Requested</Table.Th>
            <Table.Th>Leave Period</Table.Th>
            <Table.Th>Student</Table.Th>
            <Table.Th>Reason</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Reviewed By</Table.Th>
            <Table.Th>Date Reviewed</Table.Th>
            <Table.Th>Review Notes</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {requests.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={9}>
                <Text c="dimmed" ta="center" py="md">
                  No leave requests found
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            requests.map((request) => {
              const studentName = studentNameMap?.get(request.studentId);
              const canReview = isStaffView && request.status === 'pending';
              // Can cancel only if: parent view, status is pending, and not yet reviewed
              const canCancel = !isStaffView && request.status === 'pending' && !request.reviewedBy;

              return (
                <Table.Tr key={request.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {formatDate(request.createdAt)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDateRange(request.startDate, request.endDate)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {studentName || 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {request.reason}
                    </Text>
                  </Table.Td>
                  <Table.Td>{statusBadge(request.status)}</Table.Td>
                  <Table.Td>
                    {request.reviewerName ? (
                      <Text size="sm">
                        {request.reviewerName}
                        {request.reviewerRole && (
                          <Text component="span" c="dimmed" size="sm" ml={4}>
                            ({request.reviewerRole})
                          </Text>
                        )}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {request.reviewedAt ? (
                      <Text size="sm">{formatDate(request.reviewedAt)}</Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {request.reviewNotes ? (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {request.reviewNotes}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {canReview && (
                        <>
                          <Button
                            size="xs"
                            variant="light"
                            color="green"
                            onClick={() => handleReviewClick(request, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            onClick={() => handleReviewClick(request, 'reject')}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {canCancel && (
                        <Tooltip label="Cancel request" withArrow>
                          <ActionIcon
                            variant="filled"
                            color="red"
                            onClick={() => handleCancelClick(request)}
                            disabled={updateStatus.isPending}
                            loading={updateStatus.isPending}
                            style={{
                              backgroundColor: 'var(--mantine-color-red-6)',
                              color: 'white',
                            }}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })
          )}
        </Table.Tbody>
      </Table>

      {meta && meta.totalPages > 1 && (
        <Group justify="flex-end" mt="md">
          <Pagination
            value={meta.page}
            onChange={(page) => onPageChange?.(page)}
            total={meta.totalPages}
          />
        </Group>
      )}

      <Modal
        opened={reviewModalOpened}
        onClose={closeReviewModal}
        title={reviewAction === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {reviewAction === 'approve'
              ? 'You are about to approve this leave request. You can optionally add review notes below.'
              : 'You are about to reject this leave request. Please provide a reason for rejection.'}
          </Text>

          {selectedRequest && (
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                Leave Period
              </Text>
              <Text size="sm">
                {formatDateRange(selectedRequest.startDate, selectedRequest.endDate)}
              </Text>
              {studentNameMap?.get(selectedRequest.studentId) && (
                <>
                  <Text size="xs" c="dimmed" fw={500} mb={4} mt="xs">
                    Student
                  </Text>
                  <Text size="sm">{studentNameMap.get(selectedRequest.studentId)}</Text>
                </>
              )}
            </div>
          )}

          <Textarea
            label={reviewAction === 'approve' ? 'Review Notes (Optional)' : 'Rejection Reason (Required)'}
            placeholder={
              reviewAction === 'approve'
                ? 'Add any notes about this approval...'
                : 'Please provide a reason for rejection...'
            }
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            minRows={3}
            required={reviewAction === 'reject'}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeReviewModal}>
              Cancel
            </Button>
            <Button
              color={reviewAction === 'approve' ? 'green' : 'red'}
              onClick={handleConfirmReview}
              loading={updateStatus.isPending}
              disabled={reviewAction === 'reject' && !reviewNotes.trim()}
            >
              {reviewAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

