'use client';

import { useTranslations } from 'next-intl';
import {
  Table,
  Badge,
  Group,
  Button,
  Pagination,
  Text,
  Tooltip,
  Modal,
  Textarea,
  Stack,
  ActionIcon,
  ScrollArea,
  useMantineTheme,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import type { EarlyDepartureRequest } from '@/types/early-departure';
import { useUpdateEarlyDepartureStatus } from '@/hooks/useEarlyDepartures';

interface EarlyDepartureTableProps {
  requests: EarlyDepartureRequest[];
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

const statusColorMap: Record<EarlyDepartureRequest['status'], string> = {
  pending: 'yellow',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
  excused: 'blue',
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (date: string, time: string): string => {
  return `${formatDate(date)} at ${time}`;
};

export function EarlyDepartureTable({
  requests,
  meta,
  onPageChange,
  isStaffView = false,
  studentNameMap,
}: EarlyDepartureTableProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('earlyDeparture');
  const [reviewModalOpened, { open: openReviewModal, close: closeReviewModal }] = useDisclosure(false);
  const [selectedRequest, setSelectedRequest] = useState<EarlyDepartureRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const updateStatus = useUpdateEarlyDepartureStatus();

  const handleReviewClick = (request: EarlyDepartureRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes('');
    openReviewModal();
  };

  const handleCancelClick = (request: EarlyDepartureRequest) => {
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

  const statusBadge = (request: EarlyDepartureRequest) => {
    const status = request.status;
    const badge = (
      <Badge variant="light" color={statusColorMap[status] ?? 'gray'}>
        {t(status)}
      </Badge>
    );

    // Show CONFLICT badge if there's a class conflict
    if (request.hasConflict) {
      const conflictBadge = (
        <Badge variant="light" color="orange" ml="xs">
          {t('classConflictBadge')}
        </Badge>
      );
      
      if (request.conflictDetails) {
        return (
          <Group gap="xs">
            {badge}
            <Tooltip label={t('classConflictTooltip', { details: request.conflictDetails })} withArrow>
              {conflictBadge}
            </Tooltip>
          </Group>
        );
      }
      
      return (
        <Group gap="xs">
          {badge}
          {conflictBadge}
        </Group>
      );
    }

    if (status === 'pending') {
      return (
        <Tooltip label={t('pendingFromTeacher')} withArrow>
          {badge}
        </Tooltip>
      );
    }

    return badge;
  };

  return (
    <>
      <ScrollArea type="auto" scrollbars="x" w="100%">
        <Table striped highlightOnHover style={{ minWidth: 960 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('dateRequested')}</Table.Th>
              <Table.Th>{t('departureDateAndTime')}</Table.Th>
              <Table.Th>{t('student')}</Table.Th>
              <Table.Th>{t('reason')}</Table.Th>
              <Table.Th>{t('status')}</Table.Th>
              <Table.Th>{t('reviewedBy')}</Table.Th>
              <Table.Th>{t('dateReviewed')}</Table.Th>
              <Table.Th>{t('reviewNotes')}</Table.Th>
              <Table.Th>{t('actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requests.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" ta="center" py="md">
                    {t('noEarlyDepartureRequestsFound')}
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
                    <Text size="sm">{formatDateTime(request.date, request.departureTime)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {studentName || 'N/A'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {request.reason || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{statusBadge(request)}</Table.Td>
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
                            {t('approve')}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            onClick={() => handleReviewClick(request, 'reject')}
                          >
                            {t('reject')}
                          </Button>
                        </>
                      )}
                      {canCancel && (
                        <Tooltip label={t('cancelRequest')} withArrow>
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
      </ScrollArea>

      {meta && meta.totalPages > 1 && (
        <ScrollArea type="auto" scrollbars="x" w="100%" mt="md">
          <Group justify="flex-end" wrap="nowrap" gap={4} style={{ minWidth: 'min-content' }}>
            <Pagination
              value={meta.page}
              onChange={(page) => onPageChange?.(page)}
              total={meta.totalPages}
              size={isMobile ? 'sm' : 'md'}
              withEdges={!isMobile}
            />
          </Group>
        </ScrollArea>
      )}

      <Modal
        opened={reviewModalOpened}
        onClose={closeReviewModal}
        title={reviewAction === 'approve' ? t('approveEarlyDepartureRequest') : t('rejectEarlyDepartureRequest')}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {reviewAction === 'approve'
              ? t('approveConfirmMessage')
              : t('rejectConfirmMessage')}
          </Text>

          {selectedRequest && (
            <div>
              <Text size="xs" c="dimmed" fw={500} mb={4}>
                {t('departureDateAndTime')}
              </Text>
              <Text size="sm">
                {formatDateTime(selectedRequest.date, selectedRequest.departureTime)}
              </Text>
              {studentNameMap?.get(selectedRequest.studentId) && (
                <>
                  <Text size="xs" c="dimmed" fw={500} mb={4} mt="xs">
                    {t('student')}
                  </Text>
                  <Text size="sm">{studentNameMap.get(selectedRequest.studentId)}</Text>
                </>
              )}
            </div>
          )}

          <Textarea
            label={reviewAction === 'approve' ? t('reviewNotesOptional') : t('rejectionReasonRequired')}
            placeholder={
              reviewAction === 'approve'
                ? t('reviewNotesPlaceholderApprove')
                : t('reviewNotesPlaceholderReject')
            }
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            minRows={3}
            required={reviewAction === 'reject'}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeReviewModal}>
              {t('cancel')}
            </Button>
            <Button
              color={reviewAction === 'approve' ? 'green' : 'red'}
              onClick={handleConfirmReview}
              loading={updateStatus.isPending}
              disabled={reviewAction === 'reject' && !reviewNotes.trim()}
            >
              {reviewAction === 'approve' ? t('approve') : t('reject')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

