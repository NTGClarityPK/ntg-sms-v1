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
  /** Active school days (0–6, 0=Sun). When set, Days column shows only these days in the range. */
  activeSchoolDays?: number[];
  /** Dates to exclude (public holidays + vacations). When set with activeSchoolDays, Days column matches quota logic. */
  excludedDates?: Set<string>;
}

const statusColorMap: Record<LeaveRequest['status'], string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
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

/** Compute inclusive number of days between start and end (YYYY-MM-DD). */
const getLeaveDays = (startDate: string, endDate: string): number => {
  const parse = (s: string) => {
    const parts = s.trim().split('-').map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = parse(startDate);
  const end = parse(endDate);
  if (!start || !end) return 0;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays + 1);
};

/** Expand [startDate, endDate] to Set of YYYY-MM-DD strings (inclusive, local date). */
function rangeToDateSet(startDate: string, endDate: string): Set<string> {
  const parse = (s: string): Date | null => {
    const parts = s.trim().split('-').map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const start = parse(startDate);
  const end = parse(endDate);
  const out = new Set<string>();
  if (!start || !end || start > end) return out;
  const cur = new Date(start.getTime());
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.add(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Count days in [startDate, endDate] that fall on active school days (0=Sun .. 6=Sat). */
function countActiveSchoolDaysInRange(
  startDate: string,
  endDate: string,
  activeDayOfWeeks: number[],
): number {
  const parse = (s: string): Date | null => {
    const parts = s.trim().split('-').map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startParsed = parse(startDate);
  const endParsed = parse(endDate);
  if (!startParsed || !endParsed || startParsed > endParsed) return 0;
  const set = new Set(activeDayOfWeeks);
  let count = 0;
  const cur = new Date(startParsed.getTime());
  while (cur <= endParsed) {
    if (set.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Count active school days in range, excluding dates in excludedDates. */
function countActiveSchoolDaysInRangeExcluding(
  startDate: string,
  endDate: string,
  activeDayOfWeeks: number[],
  excludedDates: Set<string>,
): number {
  const parse = (s: string): Date | null => {
    const parts = s.trim().split('-').map(Number);
    if (parts.length !== 3) return null;
    const [y, m, d] = parts;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startParsed = parse(startDate);
  const endParsed = parse(endDate);
  if (!startParsed || !endParsed || startParsed > endParsed) return 0;
  const daySet = new Set(activeDayOfWeeks);
  let count = 0;
  const cur = new Date(startParsed.getTime());
  while (cur <= endParsed) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (daySet.has(cur.getDay()) && !excludedDates.has(dateStr)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function LeaveRequestTable({
  requests,
  meta,
  onPageChange,
  isStaffView = false,
  studentNameMap,
  activeSchoolDays,
  excludedDates,
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
            <Table.Th>Days</Table.Th>
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
              <Table.Td colSpan={10}>
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
                    <Text size="sm">
                      {activeSchoolDays?.length && excludedDates !== undefined
                        ? countActiveSchoolDaysInRangeExcluding(
                            request.startDate,
                            request.endDate,
                            activeSchoolDays,
                            excludedDates,
                          )
                        : activeSchoolDays?.length
                          ? countActiveSchoolDaysInRange(
                              request.startDate,
                              request.endDate,
                              activeSchoolDays,
                            )
                          : getLeaveDays(request.startDate, request.endDate)}
                    </Text>
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

