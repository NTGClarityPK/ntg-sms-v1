'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  Title,
  Tooltip,
  useMantineTheme,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconFileDownload,
  IconInfoCircle,
  IconMessage,
  IconPlus,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useClassSections } from '@/hooks/useClassSections';
import {
  useClassSectionMarksReadiness,
  useClassSectionResults,
  useGenerateResultCard,
  useResultCardsByClassSection,
  useResultReportSettings,
  useUpdateResultCardComment,
  useUpdateResultCardStatus,
} from '@/hooks/useResults';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { apiClient } from '@/lib/api-client';
import type { ClassSection } from '@/types/class-sections';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import { useMyStaff } from '@/hooks/useStaff';
import { useFeaturePermission } from '@/hooks/usePermissions';
import type { ThemeConfig } from '@/lib/theme/themeConfig';
import type { ReportKind, ResultCard } from '@/types/results';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function monthsInAcademicYear(startDate?: string, endDate?: string): number[] {
  if (!startDate || !endDate) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  const months: number[] = [];
  const seen = new Set<number>();
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    const m = cursor.getMonth() + 1;
    if (!seen.has(m)) {
      seen.add(m);
      months.push(m);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.length > 0 ? months : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
}

export default function ResultsPage() {
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [reportKind, setReportKind] = useState<ReportKind>('term_report');
  const [resultType, setResultType] = useState<'mid_term' | 'final'>('final');
  const [progressMonth, setProgressMonth] = useState<number>(new Date().getMonth() + 1);
  const [includeBreakdown, setIncludeBreakdown] = useState(false);
  const [commentModalCard, setCommentModalCard] = useState<ResultCard | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [downloadPdfVariant, setDownloadPdfVariant] = useState<'minimal' | 'modern'>('modern');
  const [pdfVariantHydrated, setPdfVariantHydrated] = useState(false);
  const [workflowHintDismissed, setWorkflowHintDismissed] = useState(false);

  const t = useTranslations('results');
  const mantineTheme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${mantineTheme.breakpoints.sm})`);
  const themeCfg = mantineTheme.other as ThemeConfig | undefined;

  const reportKindControlData = [
    { value: 'term_report', label: t('reportKindTerm') },
    { value: 'progress_report', label: t('reportKindProgress') },
  ] as const;
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { canEdit } = useFeaturePermission('results');
  const isClassTeacher =
    userTyped?.roles?.some((r) => r.roleName === 'class_teacher') ?? false;
  const { data: myStaffData, isLoading: myStaffLoading } = useMyStaff();
  const staffData = myStaffData?.data;
  const classTeacherStaffId = isClassTeacher ? staffData?.id : undefined;
  const classSectionsReady = !isClassTeacher || !!classTeacherStaffId || (!myStaffLoading && !staffData?.id);
  const classSectionsQuery = useClassSections({
    limit: 200,
    minimal: true,
    classTeacherId: classTeacherStaffId,
    enabled: classSectionsReady,
  });
  const classSectionsLoading =
    !classSectionsReady || (classSectionsQuery.isLoading && !classSectionsQuery.data);
  const activeYearQuery = useActiveAcademicYear();
  const activeYear = activeYearQuery.data?.data ?? null;
  const academicYearId = activeYear?.id;

  const monthOptions = useMemo(() => {
    const months = monthsInAcademicYear(activeYear?.startDate, activeYear?.endDate);
    return months.map((m) => ({
      value: String(m),
      label: t(`month${m}` as 'month1'),
    }));
  }, [activeYear?.startDate, activeYear?.endDate, t]);

  useEffect(() => {
    const allowed = monthOptions.map((o) => Number(o.value));
    if (allowed.length > 0 && !allowed.includes(progressMonth)) {
      setProgressMonth(allowed[0]!);
    }
  }, [monthOptions, progressMonth]);

  const effectiveResultType = reportKind === 'term_report' ? resultType : 'final';
  const activeProgressMonth = reportKind === 'progress_report' ? progressMonth : null;

  const resultsQuery = useClassSectionResults(
    classSectionId ?? null,
    academicYearId,
    effectiveResultType,
    activeProgressMonth,
  );
  const results = resultsQuery.data ?? null;

  const cardsQuery = useResultCardsByClassSection(
    classSectionId ?? null,
    academicYearId,
    effectiveResultType,
    reportKind,
    activeProgressMonth,
  );
  const cards = cardsQuery.data ?? [];

  const marksReadinessQuery = useClassSectionMarksReadiness(
    classSectionId ?? null,
    academicYearId,
    effectiveResultType,
    reportKind === 'term_report',
  );

  const resultReportSettingsQuery = useResultReportSettings(true);

  const generateMutation = useGenerateResultCard();
  const statusMutation = useUpdateResultCardStatus();
  const commentMutation = useUpdateResultCardComment();

  useEffect(() => {
    const list = (classSectionsQuery.data?.data as ClassSection[] | undefined) ?? [];
    if (list.length === 1 && !classSectionId) {
      setClassSectionId(list[0]!.id);
    }
  }, [classSectionId, classSectionsQuery.data]);

  useEffect(() => {
    if (pdfVariantHydrated) return;
    const v = resultReportSettingsQuery.data?.pdfVariant;
    if (v === 'minimal' || v === 'modern') {
      setDownloadPdfVariant(v);
      setPdfVariantHydrated(true);
    }
  }, [pdfVariantHydrated, resultReportSettingsQuery.data?.pdfVariant]);

  const visibleClassSections = (classSectionsQuery.data?.data as ClassSection[] | undefined) ?? [];
  const classOptions = useMemo(
    () =>
      [...visibleClassSections]
        .sort((a, b) => {
          const classOrderA = a.classSortOrder ?? 999;
          const classOrderB = b.classSortOrder ?? 999;
          if (classOrderA !== classOrderB) return classOrderA - classOrderB;
          const sectionOrderA = a.sectionSortOrder ?? 999;
          const sectionOrderB = b.sectionSortOrder ?? 999;
          return sectionOrderA - sectionOrderB;
        })
        .map((cs) => ({
          value: cs.id,
          label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
        })),
    [visibleClassSections],
  );

  const cardByStudent = useMemo(() => {
    const m = new Map<string, ResultCard>();
    for (const c of cards) {
      m.set(c.studentId, c);
    }
    return m;
  }, [cards]);

  const marksSummary = useMemo(() => {
    const rows = marksReadinessQuery.data ?? [];
    const missing = rows.filter((r) => r.missingAssessmentTitles.length > 0).length;
    return { missing, total: rows.length };
  }, [marksReadinessQuery.data]);

  const rankLabels = [t('rankFirst'), t('rankSecond'), t('rankThird')];

  const handleStudentPdf = async (studentId: string) => {
    if (!classSectionId) return;
    const reportType = includeBreakdown ? 'detailed' : 'basic';
    const key = `${studentId}-${reportKind}-${effectiveResultType}-${reportType}-${downloadPdfVariant}-${activeProgressMonth ?? ''}`;
    setDownloadingPdf(key);
    try {
      const params = new URLSearchParams();
      params.set('classSectionId', classSectionId);
      params.set('resultType', effectiveResultType);
      params.set('reportType', reportType);
      params.set('pdfVariant', downloadPdfVariant);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (reportKind !== 'term_report') params.set('reportKind', reportKind);
      if (activeProgressMonth != null) params.set('progressMonth', String(activeProgressMonth));
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/student/${studentId}/result-card/pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `result-card-${studentId}.pdf`);
    } catch {
      // api client surfaces errors
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleBulkZip = async () => {
    if (!classSectionId || reportKind !== 'term_report') return;
    setBulkDownloading(true);
    try {
      const params = new URLSearchParams();
      params.set('resultType', resultType);
      params.set('pdfVariant', downloadPdfVariant);
      if (academicYearId) params.set('academicYearId', academicYearId);
      const { blob, filename } = await apiClient.getBlobWithFilename(
        `/api/v1/results/class-section/${classSectionId}/bulk-pdf?${params.toString()}`,
      );
      triggerDownload(blob, filename || `results-${classSectionId}.zip`);
    } catch {
      // handled globally
    } finally {
      setBulkDownloading(false);
    }
  };

  const openCommentModal = (card: ResultCard) => {
    setCommentDraft(card.classTeacherComment ?? '');
    setCommentModalCard(card);
  };

  const handleSaveComment = async () => {
    if (!commentModalCard) return;
    try {
      await commentMutation.mutateAsync({ id: commentModalCard.id, classTeacherComment: commentDraft });
      notifications.show({ message: t('commentSaved'), color: 'green' });
      setCommentModalCard(null);
    } catch {
      // handled
    }
  };

  const handleGenerate = async (studentId: string) => {
    if (!classSectionId) return;
    if (reportKind === 'progress_report' && (progressMonth < 1 || progressMonth > 12)) {
      notifications.show({ message: t('progressMonthRequired'), color: 'yellow' });
      return;
    }
    try {
      const payload: Parameters<typeof generateMutation.mutateAsync>[0] = {
        studentId,
        classSectionId,
        academicYearId: academicYearId ?? undefined,
        reportKind,
      };
      if (reportKind === 'term_report') {
        payload.resultType = effectiveResultType;
      } else {
        payload.resultType = 'final';
        payload.progressSequence = progressMonth;
      }
      await generateMutation.mutateAsync(payload);
      notifications.show({ message: t('generateSuccess'), color: 'green' });
    } catch {
      // handled
    }
  };

  const handlePublish = (card: ResultCard) => {
    modals.openConfirmModal({
      title: t('publishConfirmTitle'),
      children: <Text size="sm">{t('publishConfirmBody')}</Text>,
      labels: { confirm: t('publishConfirmButton'), cancel: t('cancel') },
      onConfirm: async () => {
        try {
          await statusMutation.mutateAsync({ id: card.id, status: 'published' });
        } catch {
          // handled
        }
      },
    });
  };

  const handleUnpublish = (card: ResultCard) => {
    modals.openConfirmModal({
      title: t('unpublishConfirmTitle'),
      children: <Text size="sm">{t('unpublishConfirmBody')}</Text>,
      labels: { confirm: t('unpublishConfirmButton'), cancel: t('cancel') },
      confirmProps: { color: 'orange' },
      onConfirm: async () => {
        try {
          await statusMutation.mutateAsync({ id: card.id, status: 'draft' });
          notifications.show({ message: t('unpublishSuccess'), color: 'green' });
        } catch {
          // handled
        }
      },
    });
  };

  const statusBadge = (card: ResultCard | undefined) => {
    if (!card) return <Badge variant="light">{t('cardStatusNone')}</Badge>;
    if (card.status === 'published') return <Badge color="green">{t('published')}</Badge>;
    return <Badge variant="outline">{t('draft')}</Badge>;
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
        </Group>
      </div>
      <div className="page-sub-title-bar" />

      <Stack gap="md" mt="xl" px="md" pb="xl">
        <Paper p="md" withBorder>
          <Stack gap="md">
            {classSectionsLoading ? (
              <Stack gap={4} maw={400}>
                <Skeleton height={14} width={120} radius="sm" />
                <Skeleton height={36} radius="sm" />
              </Stack>
            ) : visibleClassSections.length > 1 ? (
              <Select
                id="results-select-class-section"
                label={t('classSectionLabel')}
                placeholder={t('classSectionPlaceholder')}
                data={classOptions}
                value={classSectionId}
                onChange={setClassSectionId}
                clearable
                searchable
                maw={400}
              />
            ) : null}
            {activeYear && (
              <Text size="sm" c="dimmed">
                {t('academicYearLabel')}: {activeYear.name}
              </Text>
            )}
            {classSectionId &&
              (() => {
                const selected = visibleClassSections.find((cs) => cs.id === classSectionId) ?? null;
                return selected ? (
                  <Text size="sm" c="dimmed">
                    {t('classLabel')}: {selected.className ?? ''} {selected.sectionName ?? ''}
                  </Text>
                ) : null;
              })()}
            {isMobile ? (
              <Select
                id="results-select-report-kind"
                label={t('reportKindLabel')}
                value={reportKind}
                onChange={(v) => v && setReportKind(v as ReportKind)}
                data={[...reportKindControlData]}
                allowDeselect={false}
              />
            ) : (
              <SegmentedControl
                id="results-segment-report-kind"
                value={reportKind}
                onChange={(v) => setReportKind(v as ReportKind)}
                data={[...reportKindControlData]}
              />
            )}
            {reportKind === 'term_report' && (
              <Select
                id="results-select-term-phase"
                label={t('status')}
                data={[
                  { value: 'mid_term', label: t('resultTypeMidTerm') },
                  { value: 'final', label: t('resultTypeFinal') },
                ]}
                value={resultType}
                onChange={(v) => setResultType((v as typeof resultType) ?? 'final')}
                maw={280}
              />
            )}
            {reportKind === 'progress_report' && (
              <Select
                id="results-select-progress-month"
                label={t('progressMonthLabel')}
                description={t('progressMonthParentPackHint')}
                data={monthOptions}
                value={String(progressMonth)}
                onChange={(v) => v && setProgressMonth(Number(v))}
                allowDeselect={false}
                maw={400}
              />
            )}
          </Stack>
        </Paper>

        {classSectionsLoading ? (
          <Skeleton height={120} radius="sm" />
        ) : !classSectionId && visibleClassSections.length > 1 ? (
          <Text c="dimmed" size="sm">
            {t('classSectionHint')}
          </Text>
        ) : (
          <>
            {reportKind === 'term_report' && classSectionId && (
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <Text fw={600} size="sm">
                    {t('marksReadinessTitle')}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('marksReadinessHint')}
                  </Text>
                  {marksReadinessQuery.isLoading ? (
                    <Skeleton height={20} />
                  ) : marksSummary.missing === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t('marksReadinessAllClear')}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {t('marksReadinessSummary', {
                        count: marksSummary.missing,
                        total: marksSummary.total,
                      })}
                    </Text>
                  )}
                </Stack>
              </Paper>
            )}

            {classSectionId && canEdit && reportKind === 'term_report' && (
              <Paper p="md" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={4}>
                      <Text fw={600} size="sm">
                        {t('toolbarBulkZip')}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {t('toolbarBulkZipHint')}
                      </Text>
                    </Stack>
                    <Tooltip label={t('tooltipBulkZip')} withArrow>
                      <Button
                        id="results-bulk-zip"
                        size="sm"
                        variant="light"
                        leftSection={<IconFileDownload size={16} />}
                        loading={bulkDownloading}
                        onClick={() => void handleBulkZip()}
                      >
                        {resultType === 'mid_term' ? t('downloadAllMidTerm') : t('downloadAllFinal')}
                      </Button>
                    </Tooltip>
                  </Group>
                </Stack>
              </Paper>
            )}

            {resultsQuery.isLoading ? (
              <Skeleton height={200} radius="sm" />
            ) : !results?.students?.length ? (
              <Text c="dimmed">{t('noStudents')}</Text>
            ) : (
              <>
                {!workflowHintDismissed && classSectionId && (
                  <Alert
                    variant="default"
                    icon={
                      <IconInfoCircle
                        size={18}
                        style={themeCfg ? { color: themeCfg.colors.primary } : undefined}
                      />
                    }
                    styles={
                      themeCfg
                        ? {
                            root: {
                              backgroundColor: themeCfg.colors.primaryLightest,
                              border: `1px solid ${themeCfg.colors.primaryLighter}`,
                            },
                            title: { color: themeCfg.colors.primary },
                            message: { color: themeCfg.colors.text },
                          }
                        : undefined
                    }
                    withCloseButton
                    title={t('resultsWorkflowHintTitle')}
                    onClose={() => setWorkflowHintDismissed(true)}
                  >
                    <Text size="sm">{t('resultsWorkflowHintBody')}</Text>
                  </Alert>
                )}

                <Paper withBorder p="md">
                  <Stack gap="xs">
                    <Text fw={600} size="sm">
                      {t('topStudentsTitle')}
                    </Text>
                    {([...results.students]
                      .filter((s) => s.overallPercentage != null)
                      .sort((a, b) => (b.overallPercentage ?? 0) - (a.overallPercentage ?? 0))
                      .slice(0, 3) as typeof results.students).map((s, index) => (
                      <Text key={s.studentId} size="sm">
                        {t('topStudentLine', {
                          rank: rankLabels[index] ?? `${index + 1}`,
                          name: s.studentName,
                          pct: s.overallPercentage ?? 0,
                        })}
                      </Text>
                    ))}
                  </Stack>
                </Paper>

                <Paper withBorder p="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm">
                      {t('downloadPdfVariantLabel')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('downloadPdfVariantHint')}
                    </Text>
                    <Tooltip label={t('tooltipPdfLayoutChoice')} withArrow position="top">
                      <div>
                        <SegmentedControl
                          id="results-pdf-layout"
                          value={downloadPdfVariant}
                          onChange={(v) => setDownloadPdfVariant(v as 'minimal' | 'modern')}
                          data={[
                            { value: 'minimal', label: t('pdfVariantMinimal') },
                            { value: 'modern', label: t('pdfVariantModern') },
                          ]}
                        />
                      </div>
                    </Tooltip>
                    <Switch
                      id="results-include-breakdown"
                      label={t('includeAssessmentBreakdown')}
                      description={t('includeAssessmentBreakdownHint')}
                      checked={includeBreakdown}
                      onChange={(e) => setIncludeBreakdown(e.currentTarget.checked)}
                    />
                  </Stack>
                </Paper>

                <Paper withBorder p={0} style={{ overflow: 'hidden' }}>
                  <Table.ScrollContainer minWidth={520}>
                    <Table withTableBorder withColumnBorders>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('studentName')}</Table.Th>
                          <Table.Th>{t('columnOverall')}</Table.Th>
                          <Table.Th>{t('columnCard')}</Table.Th>
                          <Table.Th style={{ whiteSpace: 'nowrap' }}>{t('actionsMenuColumn')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                      {results.students.map((s) => {
                        const card = cardByStudent.get(s.studentId);
                        const genBusy =
                          generateMutation.isPending &&
                          generateMutation.variables?.studentId === s.studentId;
                        const pdfKey = `${s.studentId}-${reportKind}-${effectiveResultType}-${includeBreakdown ? 'detailed' : 'basic'}-${downloadPdfVariant}-${activeProgressMonth ?? ''}`;
                        const pdfLoading = downloadingPdf === pdfKey;
                        const statusBusy =
                          !!card &&
                          statusMutation.isPending &&
                          statusMutation.variables?.id === card.id;
                        return (
                          <Table.Tr key={s.studentId}>
                            <Table.Td>{s.studentName}</Table.Td>
                            <Table.Td>{s.overallPercentage != null ? `${s.overallPercentage}%` : '—'}</Table.Td>
                            <Table.Td>{statusBadge(card)}</Table.Td>
                            <Table.Td>
                              <Menu shadow="md" width={280} position="bottom-end">
                                <Menu.Target>
                                  <Button
                                    id={`results-actions-${s.studentId}`}
                                    size="xs"
                                    variant="light"
                                    rightSection={<IconChevronDown size={14} />}
                                    disabled={!classSectionId}
                                  >
                                    {t('actionsMenuButton')}
                                  </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Label>{t('menuSectionDownloadPdf')}</Menu.Label>
                                  <Menu.Item
                                    leftSection={
                                      pdfLoading ? <Loader size={14} /> : <IconFileDownload size={16} stroke={1.5} />
                                    }
                                    disabled={!classSectionId || pdfLoading}
                                    onClick={() => void handleStudentPdf(s.studentId)}
                                  >
                                    {t('menuPdfDownload')}
                                  </Menu.Item>
                                  {canEdit && (
                                    <>
                                      <Menu.Divider />
                                      <Menu.Label>{t('menuSectionReportCard')}</Menu.Label>
                                      <Menu.Item
                                        leftSection={genBusy ? <Loader size={14} /> : <IconPlus size={16} stroke={1.5} />}
                                        disabled={!classSectionId || genBusy}
                                        onClick={() => void handleGenerate(s.studentId)}
                                      >
                                        {card ? t('menuUpdateDraftCard') : t('menuCreateDraftCard')}
                                      </Menu.Item>
                                      {card && (
                                        <Menu.Item
                                          leftSection={<IconMessage size={16} stroke={1.5} />}
                                          onClick={() => openCommentModal(card)}
                                        >
                                          {card.status === 'published' ? t('menuViewComments') : t('menuEditComments')}
                                        </Menu.Item>
                                      )}
                                      {card && card.status !== 'published' && (
                                        <Menu.Item
                                          leftSection={
                                            statusBusy ? <Loader size={14} /> : <IconCheck size={16} stroke={1.5} />
                                          }
                                          disabled={statusBusy}
                                          onClick={() => handlePublish(card)}
                                        >
                                          {t('menuPublishCard')}
                                        </Menu.Item>
                                      )}
                                      {card && card.status === 'published' && (
                                        <Menu.Item
                                          leftSection={
                                            statusBusy ? (
                                              <Loader size={14} />
                                            ) : (
                                              <IconArrowBackUp size={16} stroke={1.5} />
                                            )
                                          }
                                          disabled={statusBusy}
                                          onClick={() => handleUnpublish(card)}
                                        >
                                          {t('menuUnpublishCard')}
                                        </Menu.Item>
                                      )}
                                    </>
                                  )}
                                </Menu.Dropdown>
                              </Menu>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Paper>
              </>
            )}
          </>
        )}
      </Stack>

      <Modal
        opened={!!commentModalCard}
        onClose={() => setCommentModalCard(null)}
        title={t('commentModalTitle')}
      >
        <Stack gap="md">
          <Textarea
            id="results-comment-textarea"
            minRows={4}
            placeholder={t('commentModalPlaceholder')}
            value={commentDraft}
            readOnly={commentModalCard?.status === 'published'}
            onChange={(e) => setCommentDraft(e.currentTarget.value)}
          />
          {commentModalCard?.status === 'published' && (
            <Text size="sm" c="dimmed">
              {t('readOnlyPublished')}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCommentModalCard(null)}>
              {t('cancel')}
            </Button>
            <Button
              loading={commentMutation.isPending}
              disabled={commentModalCard?.status === 'published'}
              onClick={() => void handleSaveComment()}
            >
              {t('save')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
