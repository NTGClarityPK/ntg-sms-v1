'use client';

/**
 * My Assessments Page (Student)
 * Shows class assessments, attachments, and allows status updates.
 */

import { useLocale, useTranslations } from 'next-intl';
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
  Tabs,
} from '@mantine/core';
import { IconDownload, IconEye, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMyAssessments, useUpdateMyAssessmentStatus } from '@/hooks/api/useMyAssessments';
import { useExportMyExaminationSchedulePdf, useMyExaminationSchedule } from '@/hooks/api/useAssessments';
import {
  useExportStudentExaminationSchedulePdf,
  useStudentAssessments,
  useStudentExaminationSchedule,
  useUpdateStudentAssessmentStatus,
} from '@/hooks/api/useStudentAssessments';
import { useStudentSessionStore } from '@/lib/store/student-session-store';
import type { MyAssessmentAttachment } from '@/hooks/api/useMyAssessments';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import type { Assessment } from '@/types/assessment';
import { formatExaminationDurationMinutes } from '@/lib/format-examination-duration';

export default function MyAssessmentsPage() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const locale = useLocale();
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();

  const { studentToken } = useStudentSessionStore();
  const isStudentMode = !!studentToken;

  const [listTab, setListTab] = useState<'all' | 'exams'>('all');

  const { data: activeYearApi } = useActiveAcademicYear();
  const activeYearId = activeYearApi?.data?.id;

  const parentQuery = useMyAssessments(!isStudentMode && listTab === 'all');
  const studentQuery = useStudentAssessments(isStudentMode && listTab === 'all');
  const { data, isLoading, error, isRefetching } = isStudentMode ? studentQuery : parentQuery;

  const parentExamSchedule = useMyExaminationSchedule(
    {
      page: 1,
      limit: 200,
      sortBy: 'due_date',
      sortOrder: 'asc',
      academicYearId: activeYearId,
    },
    !isStudentMode && listTab === 'exams',
  );
  const studentExamSchedule = useStudentExaminationSchedule(isStudentMode && listTab === 'exams');
  const exportStudentPdf = useExportStudentExaminationSchedulePdf();
  const exportMyPdf = useExportMyExaminationSchedulePdf();

  const updateParentStatus = useUpdateMyAssessmentStatus();
  const updateStudentStatus = useUpdateStudentAssessmentStatus();
  const updateStatus = isStudentMode ? updateStudentStatus : updateParentStatus;

  const activeQueryKey = isStudentMode ? 'student-assessments' : 'my-assessments';
  const [previewAttachment, setPreviewAttachment] = useState<MyAssessmentAttachment | null>(null);

  const examRows: Assessment[] = isStudentMode
    ? (studentExamSchedule.data ?? [])
    : (() => {
        const rows = parentExamSchedule.data?.data;
        return Array.isArray(rows) ? rows : [];
      })();

  const examLoading =
    isStudentMode
      ? studentExamSchedule.isLoading || studentExamSchedule.isRefetching
      : parentExamSchedule.isLoading || parentExamSchedule.isRefetching;
  const examError = isStudentMode ? studentExamSchedule.error : parentExamSchedule.error;
  const examFetching = isStudentMode ? studentExamSchedule.isFetching : parentExamSchedule.isFetching;
  const pdfLanguage = locale === 'ar' ? 'ar' : locale === 'en-US' ? 'en-US' : 'en-GB';

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
    if (isRead) return;
    // Mark as read and move to in_progress (unless already submitted)
    const nextStatus = currentStatus === 'submitted' ? 'submitted' : 'in_progress';
    updateStatus.mutate({ assessmentId, isRead: true, status: nextStatus });
  };

  const handleMarkSubmitted = (assessmentId: string, currentStatus?: string) => {
    if (currentStatus === 'submitted') return;
    // Mark as submitted and read
    updateStatus.mutate({ assessmentId, status: 'submitted', isRead: true });
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

  const refreshLoading = listTab === 'all' ? isRefetching : examFetching;

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
              loading={refreshLoading}
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: [activeQueryKey] });
                void queryClient.invalidateQueries({ queryKey: ['assessments', 'my', 'examination-schedule'] });
                void queryClient.invalidateQueries({ queryKey: ['student-assessments', 'examination-schedule'] });
              }}
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
          <Tabs
            value={listTab}
            onChange={(v) => {
              setListTab(v === 'exams' ? 'exams' : 'all');
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="all">{t('myAssessmentsTabAll')}</Tabs.Tab>
              <Tabs.Tab value="exams">{t('myAssessmentsTabExams')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="all" pt="md">
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
                          <Table.Th style={{ textAlign: 'center', minWidth: isMobile ? 200 : undefined }}>
                            {tCommon('actions')}
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {data.map((item) => {
                          const a = item.assessment;
                          const status = item.status;
                          const isRead = status?.isRead ?? false;
                          const subjectName = a.subjectName;
                          const teacherName = a.teacherName;
                          const statusValue = status?.status;

                          return (
                            <Table.Tr key={a.id}>
                              <Table.Td>
                                <Stack gap={6}>
                                  <Text fw={600} lh={1.25}>
                                    {a.title}
                                  </Text>
                                  <Group gap="xs" wrap="wrap">
                                    <Badge variant="light" color="blue">
                                      {t('subject')}: {subjectName ?? '—'}
                                    </Badge>
                                    <Text size="sm" c="dimmed">
                                      {t('postedBy')}: <Text span fw={500} c="dark">{teacherName ?? '—'}</Text>
                                    </Text>
                                  </Group>
                                  {a.description ? (
                                    <Text size="sm" c="dimmed" lineClamp={2}>
                                      {a.description}
                                    </Text>
                                  ) : null}
                                </Stack>
                              </Table.Td>
                              <Table.Td>{renderStatusBadge(status?.status, isRead)}</Table.Td>
                              <Table.Td>
                                {a.dueDate ? dayjs(a.dueDate).format('DD MMM YYYY HH:mm') : '—'}
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
                              <Table.Td style={{ verticalAlign: 'middle' }}>
                                <Group justify={isMobile ? 'flex-start' : 'center'}>
                                  {statusValue === 'submitted' ? (
                                    <Badge color="green" variant="filled">
                                      {t('submitted')}
                                    </Badge>
                                  ) : !isRead ? (
                                    <Button
                                      size="xs"
                                      variant="light"
                                      miw={140}
                                      onClick={() => handleMarkRead(a.id, statusValue, isRead)}
                                    >
                                      {t('markAsRead')}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="xs"
                                      color="green"
                                      variant="light"
                                      miw={140}
                                      onClick={() => handleMarkSubmitted(a.id, statusValue)}
                                    >
                                      {t('markSubmitted')}
                                    </Button>
                                  )}
                                </Group>
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
            </Tabs.Panel>

            <Tabs.Panel value="exams" pt="md">
              <Paper p="md" withBorder>
                <Group justify="flex-end" mb="sm">
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    disabled={examRows.length === 0 || examLoading}
                    loading={
                      !(examRows.length === 0 || examLoading) &&
                      (isStudentMode ? exportStudentPdf.isPending : exportMyPdf.isPending)
                    }
                    onClick={() => {
                      if (isStudentMode) {
                        exportStudentPdf.mutate({ language: pdfLanguage });
                      } else {
                        exportMyPdf.mutate({ academicYearId: activeYearId, language: pdfLanguage });
                      }
                    }}
                  >
                    {t('examinationScheduleExportPdf')}
                  </Button>
                </Group>
                {examLoading ? (
                  <Stack gap="md">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} height={60} />
                    ))}
                  </Stack>
                ) : examError ? (
                  <Text c="red" ta="center" py="xl">
                    {t('failedToLoadYourAssessments')}
                  </Text>
                ) : examRows.length > 0 ? (
                  <ScrollArea type="auto" scrollbars="x" w="100%">
                    <Table striped highlightOnHover style={{ minWidth: isMobile ? 560 : 520 }}>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('examinationScheduleDate')}</Table.Th>
                          <Table.Th>{t('examinationScheduleTime')}</Table.Th>
                          <Table.Th>{t('examinationScheduleDuration')}</Table.Th>
                          <Table.Th>{t('examinationScheduleSubject')}</Table.Th>
                          <Table.Th>{t('classSection')}</Table.Th>
                          <Table.Th>{t('examinationScheduleSyllabus')}</Table.Th>
                          <Table.Th>{t('examinationScheduleRoom')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {examRows.map((row) => (
                          <Table.Tr key={row.id}>
                            <Table.Td>
                              {row.dueDate ? dayjs(row.dueDate).format('DD MMM YYYY') : '—'}
                            </Table.Td>
                            <Table.Td>
                              {row.dueDate ? dayjs(row.dueDate).format('HH:mm') : '—'}
                            </Table.Td>
                            <Table.Td>
                              {row.examinationDurationMinutes != null &&
                              !Number.isNaN(Number(row.examinationDurationMinutes))
                                ? formatExaminationDurationMinutes(
                                    Number(row.examinationDurationMinutes),
                                    locale,
                                  )
                                : '—'}
                            </Table.Td>
                            <Table.Td>{row.subjectName ?? '—'}</Table.Td>
                            <Table.Td>{row.classSectionName ?? '—'}</Table.Td>
                            <Table.Td>
                              <Text size="sm" lineClamp={3}>
                                {row.description?.trim() ? row.description : '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td>{row.roomNumber?.trim() ? row.roomNumber : '—'}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <Text ta="center" c="dimmed" py="xl">
                    {t('examinationScheduleEmpty')}
                  </Text>
                )}
              </Paper>
            </Tabs.Panel>
          </Tabs>
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
