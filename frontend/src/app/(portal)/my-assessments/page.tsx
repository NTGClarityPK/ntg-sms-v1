'use client';

/**
 * My Assessments Page (Student)
 * Shows class assessments, attachments, and allows status updates.
 */

import { useTranslations } from 'next-intl';
import {
  Title,
  Paper,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  ScrollArea,
  Table,
  Skeleton,
  ActionIcon,
  Tooltip,
  Modal,
  Image,
  useMantineTheme,
} from '@mantine/core';
import { IconDownload, IconEye, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyAssessments, useUpdateMyAssessmentStatus } from '@/hooks/api/useMyAssessments';
import { useStudentAssessments, useUpdateStudentAssessmentStatus } from '@/hooks/api/useStudentAssessments';
import { useStudentSessionStore } from '@/lib/store/student-session-store';
import type { MyAssessmentAttachment } from '@/hooks/api/useMyAssessments';

export default function MyAssessmentsPage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const { studentToken } = useStudentSessionStore();
  const isStudentMode = !!studentToken;

  const parentQuery = useMyAssessments(!isStudentMode);
  const studentQuery = useStudentAssessments(isStudentMode);
  const { data, isLoading, error, isRefetching } = isStudentMode ? studentQuery : parentQuery;

  const updateParentStatus = useUpdateMyAssessmentStatus();
  const updateStudentStatus = useUpdateStudentAssessmentStatus();
  const updateStatus = isStudentMode ? updateStudentStatus : updateParentStatus;

  const activeQueryKey = isStudentMode ? 'student-assessments' : 'my-assessments';
  const [previewAttachment, setPreviewAttachment] = useState<MyAssessmentAttachment | null>(null);

  const previewType = useMemo(() => {
    if (!previewAttachment) return 'none' as const;

    const fileName = previewAttachment.fileName.toLowerCase();
    const mimeType = previewAttachment.mimeType?.toLowerCase() ?? '';

    const isImage = mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(fileName);
    if (isImage) return 'image' as const;

    const isPdf = mimeType.includes('pdf') || fileName.endsWith('.pdf');
    if (isPdf) return 'pdf' as const;

    const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov|ogg|avi|mkv)$/.test(fileName);
    if (isVideo) return 'video' as const;

    return 'unsupported' as const;
  }, [previewAttachment]);

  const handleMarkRead = (assessmentId: string, currentStatus?: string, isRead?: boolean) => {
    if (isRead) {
      // Toggle to unread and reset status to not_started
      updateStatus.mutate({ assessmentId, isRead: false, status: 'not_started' });
    } else {
      // Mark as read and move to in_progress (unless already submitted)
      const nextStatus = currentStatus === 'submitted' ? 'submitted' : 'in_progress';
      updateStatus.mutate({ assessmentId, isRead: true, status: nextStatus });
    }
  };

  const handleMarkSubmitted = (assessmentId: string, currentStatus?: string) => {
    if (currentStatus === 'submitted') {
      // Toggle to not submitted, keep as read and in progress
      updateStatus.mutate({ assessmentId, status: 'in_progress', isRead: true });
    } else {
      // Mark as submitted and read
      updateStatus.mutate({ assessmentId, status: 'submitted', isRead: true });
    }
  };

  const renderStatusBadge = (status?: string, isRead?: boolean) => {
    if (!status) {
      return (
        <Badge color="gray" variant="light">
          {t('notStarted')}
        </Badge>
      );
    }

    if (status === 'submitted') {
      return (
        <Badge color="green" variant="filled">
          {isRead ? t('submitted') : t('submittedUnread')}
        </Badge>
      );
    }

    if (status === 'in_progress') {
      return (
        <Badge color="yellow" variant="light">
          {isRead ? t('inProgress') : t('inProgressUnread')}
        </Badge>
      );
    }

    return (
      <Badge color="gray" variant="light">
        {status}
      </Badge>
    );
  };

  const openInNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadAll = (attachments: MyAssessmentAttachment[]) => {
    attachments.forEach((att, i) => {
      setTimeout(() => {
        window.open(att.fileUrl, '_blank', 'noopener,noreferrer');
      }, i * 250);
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="sm">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={2}>
            {t('myAssessmentTitle')}
          </Title>
          <Tooltip label={tCommon('retry')}>
            <ActionIcon
              variant="light"
              size="lg"
              style={{ flexShrink: 0 }}
              loading={isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: [activeQueryKey] })}
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
            {isLoading || isRefetching ? (
              <Stack gap="md">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} height={60} />
                ))}
              </Stack>
            ) : error ? (
              <Text c="red" ta="center" py="xl">
                {t('failedToLoadYourAssessments')}
              </Text>
            ) : data && data.length > 0 ? (
              <ScrollArea type="auto" scrollbars="x" w="100%">
                <Table striped highlightOnHover style={{ minWidth: isMobile ? 640 : 560 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('titleColumn')}</Table.Th>
                      <Table.Th>{t('status')}</Table.Th>
                      <Table.Th>{t('dueDate')}</Table.Th>
                      <Table.Th>{t('attachments')}</Table.Th>
                      <Table.Th style={{ textAlign: isMobile ? 'left' : 'right', minWidth: isMobile ? 200 : undefined }}>
                        {tCommon('actions')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.map((item) => {
                      const a = item.assessment;
                      const status = item.status;
                      const isRead = status?.isRead ?? false;

                      return (
                        <Table.Tr key={a.id}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text fw={500}>{a.title}</Text>
                              {a.description && (
                                <Text size="xs" c="dimmed">
                                  {a.description}
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td>{renderStatusBadge(status?.status, isRead)}</Table.Td>
                          <Table.Td>
                            {a.dueDate
                              ? dayjs(a.dueDate).format('DD MMM YYYY')
                              : '—'}
                          </Table.Td>
                          <Table.Td>
                            {item.attachments.length > 0 ? (
                              <Group gap="xs">
                                {item.attachments.map((att) => (
                                  <Tooltip key={att.id} label={t('viewFileName', { fileName: att.fileName })}>
                                    <ActionIcon
                                      variant="subtle"
                                      onClick={() => setPreviewAttachment(att)}
                                    >
                                      <IconEye size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                ))}
                                <Tooltip label={t('downloadAll')}>
                                  <ActionIcon
                                    variant="subtle"
                                    onClick={() => handleDownloadAll(item.attachments)}
                                  >
                                    <IconDownload size={16} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed">
                                {t('noAttachments')}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: 'top' }}>
                            {isMobile ? (
                              <Stack gap="xs" maw={220}>
                                <Button
                                  size="xs"
                                  variant="light"
                                  fullWidth
                                  onClick={() => handleMarkRead(a.id, status?.status, isRead)}
                                >
                                  {isRead ? t('markUnread') : t('markAsRead')}
                                </Button>
                                <Button
                                  size="xs"
                                  color="green"
                                  variant="light"
                                  fullWidth
                                  onClick={() => handleMarkSubmitted(a.id, status?.status)}
                                >
                                  {status?.status === 'submitted' ? t('markNotSubmitted') : t('markSubmitted')}
                                </Button>
                              </Stack>
                            ) : (
                              <Group justify="flex-end" gap="xs" wrap="nowrap">
                                <Button
                                  size="xs"
                                  variant="subtle"
                                  onClick={() => handleMarkRead(a.id, status?.status, isRead)}
                                >
                                  {isRead ? t('markUnread') : t('markAsRead')}
                                </Button>
                                <Button
                                  size="xs"
                                  color="green"
                                  onClick={() => handleMarkSubmitted(a.id, status?.status)}
                                >
                                  {status?.status === 'submitted' ? t('markNotSubmitted') : t('markSubmitted')}
                                </Button>
                              </Group>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            ) : (
              <Text ta="center" c="dimmed" py="xl">
                {t('noAssessmentsAssigned')}
              </Text>
            )}
          </Paper>
        </Stack>
      </div>

      <Modal
        opened={!!previewAttachment}
        onClose={() => setPreviewAttachment(null)}
        title={previewAttachment?.fileName ?? t('attachmentPreview')}
        size="xl"
        centered
      >
        {!previewAttachment ? null : previewType === 'image' ? (
          <Image src={previewAttachment.fileUrl} alt={previewAttachment.fileName} fit="contain" radius="sm" />
        ) : previewType === 'pdf' ? (
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              {t('pdfPreviewNote')}
            </Text>
            <iframe
              src={previewAttachment.fileUrl}
              title={previewAttachment.fileName}
              style={{
                width: '100%',
                minHeight: '70vh',
                border: '1px solid var(--mantine-color-gray-3)',
                borderRadius: '8px',
              }}
            />
          </Stack>
        ) : previewType === 'video' ? (
          <video
            controls
            style={{
              width: '100%',
              maxHeight: '70vh',
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: '8px',
            }}
            src={previewAttachment.fileUrl}
          >
            {t('videoNotSupported')}{' '}
            <a href={previewAttachment.fileUrl} target="_blank" rel="noopener noreferrer">
              {t('downloadInstead')}
            </a>
          </video>
        ) : (
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              {t('previewNotAvailable')}
            </Text>
            <Group justify="flex-end">
              <Button onClick={() => openInNewTab(previewAttachment.fileUrl)} leftSection={<IconDownload size={16} />}>
                {t('downloadFile')}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}


