'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Box,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  SimpleGrid,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { DatePickerInput, MonthPickerInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { IconAlertCircle, IconCash, IconDownload, IconFileInvoice, IconSettings } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  useFeeChallanRoster,
  useFeeChallanPreview,
  useInheritedTemplateCandidates,
  useFeeTemplates,
  useCreateFeeStudentTemplateLink,
  useGenerateFeeChallans,
  usePrefetchStudentFeeTemplates,
  useStudentFeeTemplates,
  useUpdateFeeStudentTemplateLink,
  useMarkFeePaid,
  useEnsureFeeChallanPdf,
} from '@/hooks/api/useFees';
import type { FeeChallanMetricEdit, FeeChallanTemplateEdit } from '@/types/fees';
import { useClassSections } from '@/hooks/useClassSections';
import { ChallanRosterStatusBadge } from '@/components/fees/challan-roster-status-badge';

function isValidMonth(m: string) {
  return /^[0-9]{4}-[0-9]{2}$/.test(m);
}

function toYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

type GenerateTarget = null | { kind: 'bulk' } | { kind: 'single'; studentId: string };

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${Date.now()}`;
}

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoDateOrNull(d: Date | null): string | null {
  return d ? toLocalIsoDate(d) : null;
}

function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function formatLastGeneratedLabel(d: Date): string {
  const day = d.getDate();
  const datePart = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .toUpperCase();
  return `${day}${ordinalSuffix(day)} ${datePart} ${timePart}`;
}

function addCalendarDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function ChallansTab() {
  const t = useTranslations('fees');
  const tCommon = useTranslations('common');
  const theme = useMantineTheme();
  const router = useRouter();

  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);

  const [bulkSpecificityModalOpened, setBulkSpecificityModalOpened] = useState(false);
  const [bulkSelectedTemplateId, setBulkSelectedTemplateId] = useState<string | null>(null);
  const [bulkCandidatesInModal, setBulkCandidatesInModal] = useState<typeof bulkCandidates | null>(null);
  const [bulkCandidatesLoadingInModal, setBulkCandidatesLoadingInModal] = useState(false);
  const [bulkCandidatesErrorInModal, setBulkCandidatesErrorInModal] = useState<string | null>(null);

  const [studentGenerateModal, setStudentGenerateModal] = useState<null | { studentId: string; studentName: string }>(null);
  const [generateTarget, setGenerateTarget] = useState<GenerateTarget>(null);

  const prefetchStudentFeeTemplates = usePrefetchStudentFeeTemplates();

  const classSectionsQuery = useClassSections({ page: 1, limit: 200, minimal: true, isActive: true });
  const selectedClassSection = useMemo(() => {
    const list = classSectionsQuery.data?.data ?? [];
    return classSectionId ? list.find((cs) => cs.id === classSectionId) ?? null : null;
  }, [classSectionId, classSectionsQuery.data?.data]);

  const activeMonth = selectedMonth ? toYearMonth(selectedMonth) : '';

  const monthBounds = useMemo(() => {
    if (!selectedMonth) return null;
    const y = selectedMonth.getFullYear();
    const m = selectedMonth.getMonth();
    return {
      minDate: new Date(y, m, 1),
      maxDate: new Date(y, m + 1, 0),
    };
  }, [selectedMonth]);

  /** Due date default: day 10 of selected fee month (overridden by package when templates load). */
  const individualDefaultDueDate = useMemo(() => {
    if (!selectedMonth) return addCalendarDays(new Date(), 10);
    return new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 10);
  }, [selectedMonth]);

  const rosterQuery = useFeeChallanRoster({
    classId: selectedClassSection?.classId,
    sectionId: selectedClassSection?.sectionId,
    month: activeMonth || undefined,
  });

  const inheritedCandidatesQuery = useInheritedTemplateCandidates({
    classId: selectedClassSection?.classId,
    sectionId: selectedClassSection?.sectionId,
  });

  const generateMutation = useGenerateFeeChallans();
  const markPaidMutation = useMarkFeePaid();
  const ensurePdfMutation = useEnsureFeeChallanPdf({ mode: 'admin' });
  const [markPaidChallanId, setMarkPaidChallanId] = useState<string | null>(null);
  const [pdfLoadingChallanId, setPdfLoadingChallanId] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLast = window.localStorage.getItem('fees_bulk_generate_last_generated_at');
    if (storedLast) {
      const d = new Date(storedLast);
      if (!Number.isNaN(d.getTime())) setLastGeneratedAt(d);
    }
  }, []);

  const rosterAllowed = Boolean(classSectionId && activeMonth && isValidMonth(activeMonth));
  const rosterRows = rosterAllowed ? (rosterQuery.data ?? []) : [];
  /** Only the initial load for this class/month key — refetch keeps showing the table. */
  const rosterBusy = rosterAllowed && rosterQuery.isPending;

  const classSectionOptions = useMemo(() => {
    const list = classSectionsQuery.data?.data ?? [];
    const sorted = [...list].sort((a, b) => {
      const aClass = a.classSortOrder ?? Number.MAX_SAFE_INTEGER;
      const bClass = b.classSortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aClass !== bClass) return aClass - bClass;

      const aSection = a.sectionSortOrder ?? Number.MAX_SAFE_INTEGER;
      const bSection = b.sectionSortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aSection !== bSection) return aSection - bSection;

      const aLabel = `${a.classDisplayName ?? a.className ?? ''} ${a.sectionName ?? ''}`.trim();
      const bLabel = `${b.classDisplayName ?? b.className ?? ''} ${b.sectionName ?? ''}`.trim();
      return aLabel.localeCompare(bLabel);
    });

    return sorted.map((cs) => ({
      value: cs.id,
      label: `${cs.classDisplayName ?? cs.className ?? ''}-${cs.sectionName ?? ''}`.replace('--', '-').trim(),
    }));
  }, [classSectionsQuery.data?.data]);

  const allStudentIdsInRoster = useMemo(() => rosterRows.map((r) => r.studentId), [rosterRows]);

  // Enable bulk generation only when at least one student has a non-empty fee preview for the selected month.
  // This matches the expected behaviour: no templates linked → no challans to generate.
  const previewStudentId = rosterBusy || rosterRows.length === 0 ? undefined : rosterRows[0]?.studentId;
  const bulkPreviewQuery = useStudentFeeTemplates(previewStudentId, { month: activeMonth || undefined });
  const previewForMonth =
    bulkPreviewQuery.data?.preview?.month === activeMonth ? bulkPreviewQuery.data.preview : undefined;

  const awaitingBulkTemplateCheck =
    rosterAllowed &&
    !rosterBusy &&
    rosterRows.length > 0 &&
    !bulkPreviewQuery.isError &&
    previewForMonth === undefined &&
    (bulkPreviewQuery.isFetching || bulkPreviewQuery.isPending);

  const hasApplicableTemplates = !!previewForMonth && previewForMonth.items.length > 0;

  const bulkGenerateInFlight = generateMutation.isPending && generateTarget?.kind === 'bulk';

  const bulkCandidates = inheritedCandidatesQuery.data;
  const bulkCandidatesTotal =
    (bulkCandidates?.level?.length ?? 0) +
    (bulkCandidates?.class?.length ?? 0) +
    (bulkCandidates?.classSection?.length ?? 0);

  const countCandidates = (c?: typeof bulkCandidates) =>
    (c?.level?.length ?? 0) + (c?.class?.length ?? 0) + (c?.classSection?.length ?? 0);

  const bulkCandidateCards = useMemo(() => {
    const normalise = <T extends { currencyCode?: 'PKR' | 'IQD' | 'SAR' | 'USD' }>(tpl: T) => ({
      ...tpl,
      currencyCode: tpl.currencyCode ?? 'PKR',
    });
    const src = bulkCandidatesInModal ?? bulkCandidates;
    const level = (src?.level ?? []).map((tpl) => ({ ...normalise(tpl), source: 'level' as const, rank: 1 }));
    const klass = (src?.class ?? []).map((tpl) => ({ ...normalise(tpl), source: 'class' as const, rank: 2 }));
    const classSection = (src?.classSection ?? []).map((tpl) => ({
      ...normalise(tpl),
      source: 'classSection' as const,
      rank: 3,
    }));
    return [...classSection, ...klass, ...level];
  }, [bulkCandidates, bulkCandidatesInModal]);

  const autoDiscounts = useMemo(() => {
    const d = (bulkCandidatesInModal ?? bulkCandidates)?.discounts;
    if (!d) return [];
    const normalise = <T extends { currencyCode?: 'PKR' | 'IQD' | 'SAR' | 'USD' }>(tpl: T) => ({
      ...tpl,
      currencyCode: tpl.currencyCode ?? 'PKR',
    });
    const level = (d.level ?? []).map((tpl) => ({ ...normalise(tpl), source: 'level' as const, rank: 1 }));
    const klass = (d.class ?? []).map((tpl) => ({ ...normalise(tpl), source: 'class' as const, rank: 2 }));
    const classSection = (d.classSection ?? []).map((tpl) => ({ ...normalise(tpl), source: 'classSection' as const, rank: 3 }));
    // Show most specific first, mirroring the main cards ordering
    return [...classSection, ...klass, ...level];
  }, [bulkCandidates, bulkCandidatesInModal]);

  const highestSpecificityRank = bulkCandidateCards.reduce((max, c) => Math.max(max, c.rank), 0);

  const canBulkGenerate =
    !!classSectionId &&
    !!activeMonth &&
    isValidMonth(activeMonth) &&
    !rosterBusy &&
    allStudentIdsInRoster.length > 0 &&
    hasApplicableTemplates;

  const singleGenerateInFlightForOpenModal =
    generateMutation.isPending &&
    generateTarget?.kind === 'single' &&
    studentGenerateModal?.studentId === generateTarget.studentId;

  const runBulkGenerate = async (selectedInheritedTemplateId: string) => {
    setGenerateTarget({ kind: 'bulk' });
    try {
      const results = await generateMutation.mutateAsync({
        studentIds: allStudentIdsInRoster,
        months: activeMonth ? [activeMonth] : [],
        autoCalculateDueDate: true,
        selectedInheritedTemplateId,
      });
      notifications.show({
        title: t('challans.generatedTitle'),
        message: t('challans.generatedMessage', { count: results.length }),
        color: 'green',
      });
      void rosterQuery.refetch();
      const now = new Date();
      setLastGeneratedAt(now);
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('fees_bulk_generate_last_generated_at', now.toISOString());
        }
      } catch {
        // non-blocking
      }
    } catch (error) {
      notifications.show({
        title: t('challans.generateErrorTitle'),
        message: error instanceof Error ? error.message : t('challans.generateErrorMessage'),
        color: 'red',
      });
    } finally {
      setGenerateTarget(null);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Stack gap={4}>
          <Text fw={600}>{t('tabs.challans')}</Text>
          {lastGeneratedAt ? (
            <Text size="sm" c="dimmed">
              {t('challans.lastGeneratedLabel', { at: formatLastGeneratedLabel(lastGeneratedAt) })}
            </Text>
          ) : null}
        </Stack>
        <Button
          id="fees-challans-generate"
          leftSection={<IconFileInvoice size={16} />}
          onClick={async () => {
            if (!selectedClassSection?.classId || !selectedClassSection?.sectionId) return;

            setBulkCandidatesErrorInModal(null);
            setBulkCandidatesInModal(null);
            setBulkCandidatesLoadingInModal(true);

            let candidates = bulkCandidates;
            try {
              const candidatesRes = await inheritedCandidatesQuery.refetch();
              candidates = candidatesRes.data ?? candidates;
              setBulkCandidatesInModal(candidates ?? null);
            } catch (e) {
              setBulkCandidatesErrorInModal(
                e instanceof Error ? e.message : t('challans.generateErrorMessage'),
              );
              setBulkCandidatesLoadingInModal(false);
              setBulkSpecificityModalOpened(true);
              return;
            } finally {
              setBulkCandidatesLoadingInModal(false);
            }

            const total = countCandidates(candidates ?? undefined);
            const defaultId =
              candidates?.classSection?.[0]?.templateId ??
              candidates?.class?.[0]?.templateId ??
              candidates?.level?.[0]?.templateId ??
              null;

            if (total === 1 && defaultId) {
              setBulkSelectedTemplateId(defaultId);
              await runBulkGenerate(defaultId);
              return;
            }

            setBulkSelectedTemplateId(defaultId);
            setBulkSpecificityModalOpened(true);
          }}
          disabled={!canBulkGenerate || bulkGenerateInFlight}
          loading={canBulkGenerate && bulkGenerateInFlight}
        >
          {t('challans.generate')}
        </Button>
      </Group>

      <Modal
        opened={bulkSpecificityModalOpened}
        onClose={() => {
          setBulkSpecificityModalOpened(false);
          setBulkCandidatesLoadingInModal(false);
          setBulkCandidatesErrorInModal(null);
          setBulkCandidatesInModal(null);
        }}
        title={t('challans.specificityModalTitle')}
        size="lg"
      >
        <Stack gap="md">
          {bulkCandidatesLoadingInModal ? (
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                {tCommon('loading')}
              </Text>
            </Group>
          ) : bulkCandidatesErrorInModal ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title={t('challans.generateErrorTitle')}>
              {bulkCandidatesErrorInModal}
            </Alert>
          ) : null}

          <Text size="sm" c="dimmed">
            {t('challans.specificityRule')}
          </Text>

          {autoDiscounts.length > 0 ? (
            <Box>
              <Group gap={8} mb={6}>
                <Badge color="orange" variant="light">
                  {t('challans.autoDiscountsBadge')}
                </Badge>
                <Text size="sm" fw={600}>
                  {t('challans.autoDiscountsTitle')}
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                {t('challans.autoDiscountsDescription')}
              </Text>
              <Group gap={6} mt={8} wrap="wrap">
                {autoDiscounts.map((d) => (
                  <Badge key={d.templateId} color="orange" variant="outline">
                    {d.name}
                  </Badge>
                ))}
              </Group>
            </Box>
          ) : null}

          {bulkCandidateCards.length === 0 ? (
            <Paper withBorder radius="md" p="md">
              <Text size="sm" c="dimmed">
                {t('challans.specificityNone')}
              </Text>
            </Paper>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {bulkCandidateCards.map((tpl) => {
                const selected = bulkSelectedTemplateId === tpl.templateId;
                const isHighestSpecificity = tpl.rank === highestSpecificityRank;
                const scopeLabel =
                  tpl.source === 'classSection'
                    ? t('challans.specificityClassSection')
                    : tpl.source === 'class'
                      ? t('challans.specificityClass')
                      : t('challans.specificityLevel');

                return (
                  <Paper
                    key={tpl.templateId}
                    id={`fees-challans-specificity-pick-${tpl.templateId}`}
                    withBorder
                    radius="md"
                    p="md"
                    onClick={() => setBulkSelectedTemplateId(tpl.templateId)}
                    style={{
                      cursor: 'pointer',
                      borderColor: selected ? theme.colors.green[6] : theme.colors.gray[3],
                      background: selected ? theme.colors.green[0] : undefined,
                      transition: 'border-color 120ms ease, background-color 120ms ease',
                    }}
                  >
                    <Stack gap={8}>
                      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                          <Text fw={600} lineClamp={2}>
                            {tpl.name}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {scopeLabel}
                          </Text>
                        </Stack>
                        <Stack gap={6} align="flex-end">
                          {isHighestSpecificity ? (
                            <Badge variant={selected ? 'filled' : 'light'} color="green">
                              {t('challans.specificityMostSpecific')}
                            </Badge>
                          ) : null}
                          {selected ? (
                            <Badge variant="filled" color="green">
                              {t('challans.selected')}
                            </Badge>
                          ) : null}
                        </Stack>
                      </Group>

                      <Group gap={6}>
                        <Badge variant="light">{tpl.type}</Badge>
                        <Badge variant="light">{tpl.scope}</Badge>
                      </Group>

                      <Divider />

                      <Stack gap={6}>
                        <Text size="sm" fw={600}>
                          {t('challans.templateMetrics')}
                        </Text>
                        {(tpl.metrics ?? []).length === 0 ? (
                          <Text size="sm" c="dimmed">
                            {t('challans.noMetrics')}
                          </Text>
                        ) : (
                          <>
                            {(tpl.metrics ?? []).slice(0, 4).map((m) => {
                              const amountLabel =
                                m.amountType === 'Percentage'
                                  ? `${m.amount}%`
                                  : new Intl.NumberFormat(undefined, {
                                      style: 'currency',
                                      currency: tpl.currencyCode ?? 'PKR',
                                    }).format(m.amount);
                              const suffix = m.perDay ? ` / ${t('challans.perDay')}` : '';
                              return (
                                <Group key={m.id} justify="space-between" gap="sm" wrap="nowrap">
                                  <Text size="sm" lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
                                    {m.name}
                                  </Text>
                                  <Text size="sm" fw={600}>
                                    {amountLabel}
                                    {suffix}
                                  </Text>
                                </Group>
                              );
                            })}
                            {(tpl.metrics ?? []).length > 4 ? (
                              <Text size="sm" c="dimmed">
                                {t('challans.moreMetrics', { count: (tpl.metrics ?? []).length - 4 })}
                              </Text>
                            ) : null}
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </SimpleGrid>
          )}

          <Group justify="flex-end">
            <Button
              id="fees-challans-specificity-cancel"
              variant="subtle"
              onClick={() => setBulkSpecificityModalOpened(false)}
              disabled={bulkGenerateInFlight}
            >
              {t('common.cancel')}
            </Button>
            <Button
              id="fees-challans-specificity-confirm"
              onClick={async () => {
                if (!bulkSelectedTemplateId) return;
                setBulkSpecificityModalOpened(false);
                await runBulkGenerate(bulkSelectedTemplateId);
              }}
              disabled={!bulkSelectedTemplateId || bulkGenerateInFlight || bulkCandidatesLoadingInModal}
              loading={!bulkGenerateInFlight ? false : bulkGenerateInFlight}
            >
              {t('challans.specificityConfirmGenerate')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Select
        id="fees-challans-class-section"
        label={t('challans.selectClassLabel')}
        placeholder={t('challans.selectClassPlaceholder')}
        data={classSectionOptions}
        value={classSectionId}
        onChange={setClassSectionId}
        searchable
        nothingFoundMessage={t('challans.noClassesFound')}
      />

      <MonthPickerInput
        id="fees-challans-month"
        label={t('challans.monthLabel')}
        description={t('challans.monthDescription')}
        value={selectedMonth}
        onChange={setSelectedMonth}
        clearable
      />

      {classSectionId && !activeMonth ? (
        <Text c="dimmed">{t('challans.selectMonthHint')}</Text>
      ) : rosterBusy ? (
        <Stack gap="xs">
          <Skeleton height={18} width="30%" />
          <Skeleton height={240} />
        </Stack>
      ) : rosterQuery.error && rosterAllowed ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title={t('challans.rosterLoadErrorTitle')}>
          {t('challans.rosterLoadErrorMessage')}
        </Alert>
      ) : rosterAllowed && rosterRows.length === 0 ? (
        <Text>{t('challans.rosterEmpty')}</Text>
      ) : rosterRows.length === 0 ? null : (
        <Stack gap="sm">
          {!awaitingBulkTemplateCheck && !hasApplicableTemplates ? (
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="yellow"
              variant="light"
              title={t('challans.noTemplatesLinkedTitle')}
            >
              <Stack gap="sm">
                <Text size="sm">{t('challans.noTemplatesLinkedHint')}</Text>
                <Button
                  id="fees-challans-setup-cta"
                  size="xs"
                  variant="light"
                  leftSection={<IconSettings size={14} />}
                  onClick={() => router.push('/settings?section=fees')}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {t('challans.openFeeSettings')}
                </Button>
              </Stack>
            </Alert>
          ) : null}
          <Paper withBorder radius="md" p={0}>
            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover horizontalSpacing="md" verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('challans.rosterTable.student')}</Table.Th>
                    <Table.Th>{t('challans.rosterTable.parent')}</Table.Th>
                    <Table.Th>{t('challans.rosterTable.challan')}</Table.Th>
                    <Table.Th>{t('challans.rosterTable.status')}</Table.Th>
                    <Table.Th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {t('challans.rosterTable.actions')}
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rosterRows.map((r) => (
                    <Table.Tr key={r.studentId}>
                      <Table.Td>
                        <Text size="sm" fw={600} lineClamp={2}>
                          {r.studentName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" c="dimmed" lineClamp={2}>
                            {r.parentName ?? '—'}
                          </Text>
                          {r.parentIsStaff ? (
                            <Badge size="xs" variant="light" color="gray">
                              {t('challans.staffBadge')}
                            </Badge>
                          ) : null}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {r.challanNumber ? (
                          <Text size="sm" ff="monospace">
                            {r.challanNumber}
                          </Text>
                        ) : (
                          <Text size="sm" c="dimmed">
                            —
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <ChallanRosterStatusBadge status={r.status} />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                          {r.challanId ? (
                            <Button
                              id={`fees-challans-download-${r.studentId}`}
                              leftSection={<IconDownload size={16} />}
                              variant="light"
                              size="xs"
                              loading={
                                ensurePdfMutation.isPending && pdfLoadingChallanId === r.challanId
                              }
                              disabled={
                                ensurePdfMutation.isPending && pdfLoadingChallanId !== r.challanId
                              }
                              onClick={() => {
                                const challanId = r.challanId;
                                if (!challanId) return;
                                setPdfLoadingChallanId(challanId);
                                ensurePdfMutation.mutate(challanId, {
                                  onSuccess: (data) => {
                                    window.open(withCacheBust(data.pdfUrl), '_blank', 'noopener,noreferrer');
                                    void rosterQuery.refetch();
                                  },
                                  onError: (e: unknown) => {
                                    notifications.show({
                                      title: t('challans.pdfEnsureErrorTitle'),
                                      message:
                                        e instanceof Error
                                          ? e.message
                                          : t('challans.pdfEnsureErrorMessage'),
                                      color: 'red',
                                    });
                                  },
                                  onSettled: () => setPdfLoadingChallanId(null),
                                });
                              }}
                            >
                              {ensurePdfMutation.isPending && pdfLoadingChallanId === r.challanId
                                ? t('challans.pdfPreparing')
                                : t('challans.download')}
                            </Button>
                          ) : null}
                          {r.challanId &&
                          (r.status === 'Pending_Payment' || r.status === 'Rejected') ? (
                            <Button
                              id={`fees-challans-mark-paid-${r.studentId}`}
                              size="xs"
                              variant="light"
                              color="teal"
                              leftSection={<IconCash size={16} />}
                              loading={
                                markPaidMutation.isPending && markPaidChallanId === r.challanId
                              }
                              disabled={markPaidMutation.isPending}
                              onClick={() => {
                                const challanId = r.challanId;
                                if (!challanId) return;
                                setMarkPaidChallanId(challanId);
                                markPaidMutation.mutate(
                                  { challanId },
                                  {
                                    onSuccess: () => {
                                      notifications.show({
                                        title: t('challans.markPaidSuccessTitle'),
                                        message: t('challans.markPaidSuccessMessage'),
                                        color: 'green',
                                      });
                                      void rosterQuery.refetch();
                                    },
                                    onError: (e: unknown) => {
                                      notifications.show({
                                        title: t('challans.markPaidErrorTitle'),
                                        message:
                                          e instanceof Error
                                            ? e.message
                                            : t('challans.markPaidErrorMessage'),
                                        color: 'red',
                                      });
                                    },
                                    onSettled: () => setMarkPaidChallanId(null),
                                  },
                                );
                              }}
                            >
                              {t('challans.markPaid')}
                            </Button>
                          ) : null}
                          <Button
                            id={`fees-challans-generate-student-${r.studentId}`}
                            size="xs"
                            variant="light"
                            onClick={() =>
                              setStudentGenerateModal({ studentId: r.studentId, studentName: r.studentName })
                            }
                            onMouseEnter={() => {
                              if (activeMonth && isValidMonth(activeMonth)) {
                                void prefetchStudentFeeTemplates(r.studentId, activeMonth);
                              }
                            }}
                            onFocus={() => {
                              if (activeMonth && isValidMonth(activeMonth)) {
                                void prefetchStudentFeeTemplates(r.studentId, activeMonth);
                              }
                            }}
                            disabled={!activeMonth}
                          >
                            {t('challans.generateSingle')}
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </Stack>
      )}

      <StudentGenerateModal
        opened={!!studentGenerateModal}
        onClose={() => setStudentGenerateModal(null)}
        studentId={studentGenerateModal?.studentId ?? null}
        studentName={studentGenerateModal?.studentName ?? null}
        billingMonthYm={activeMonth}
        monthBounds={monthBounds}
        defaultDueDate={individualDefaultDueDate}
        generateMutationPending={singleGenerateInFlightForOpenModal}
        onConfirmGenerate={
          studentGenerateModal
            ? async (
                dueDateIso: string,
                overrides: { metricEdits?: FeeChallanMetricEdit[]; templateEdits?: FeeChallanTemplateEdit[] },
                billing?: { billingStartDate?: string; billingEndDate?: string },
              ) => {
                const studentId = studentGenerateModal.studentId;
                const ym = activeMonth;
                if (!ym || !isValidMonth(ym)) return;

                setGenerateTarget({ kind: 'single', studentId });
                try {
                  const results = await generateMutation.mutateAsync({
                    studentIds: [studentId],
                    months: [ym],
                    autoCalculateDueDate: false,
                    dueDate: dueDateIso,
                    billingStartDate: billing?.billingStartDate,
                    billingEndDate: billing?.billingEndDate,
                    studentOverrides:
                      (overrides.metricEdits && overrides.metricEdits.length > 0) ||
                      (overrides.templateEdits && overrides.templateEdits.length > 0)
                        ? [
                            {
                              studentId,
                              month: ym,
                              metricEdits: overrides.metricEdits,
                              templateEdits: overrides.templateEdits,
                            },
                          ]
                        : undefined,
                  });
                  if (results.length === 0) {
                    notifications.show({
                      title: t('challans.generateNothingTitle'),
                      message: t('challans.generateNothingMessage'),
                      color: 'yellow',
                    });
                  } else {
                    notifications.show({
                      title: t('challans.generatedTitle'),
                      message: t('challans.generatedMessage', { count: results.length }),
                      color: 'green',
                    });
                  }
                  await rosterQuery.refetch();
                  setStudentGenerateModal(null);
                } catch (error) {
                  notifications.show({
                    title: t('challans.generateErrorTitle'),
                    message: error instanceof Error ? error.message : t('challans.generateErrorMessage'),
                    color: 'red',
                  });
                } finally {
                  setGenerateTarget(null);
                }
              }
            : undefined
        }
      />
    </Stack>
  );
}

function StudentGenerateModal(props: {
  opened: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName: string | null;
  billingMonthYm: string;
  monthBounds: null | { minDate: Date; maxDate: Date };
  defaultDueDate: Date | null;
  generateMutationPending: boolean;
  onConfirmGenerate?: (
    dueDateIso: string,
    overrides: { metricEdits?: FeeChallanMetricEdit[]; templateEdits?: FeeChallanTemplateEdit[] },
    billing?: { billingStartDate?: string; billingEndDate?: string },
  ) => Promise<void>;
}) {
  const t = useTranslations('fees');
  const ym = props.billingMonthYm.trim();
  const hasBillingMonth = !!ym && isValidMonth(ym);
  const [studentDueDate, setStudentDueDate] = useState<Date | null>(null);
  const [billingStart, setBillingStart] = useState<Date | null>(null);
  const [selectedIndividualTemplateId, setSelectedIndividualTemplateId] = useState<string | null>(null);
  const [metricEdits, setMetricEdits] = useState<Record<string, { exclude: boolean; overrideAmount?: number | null }>>({});
  const [excludedTemplateIds, setExcludedTemplateIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!props.opened) return;
    setStudentDueDate(props.defaultDueDate);
    setBillingStart(null);
    setSelectedIndividualTemplateId(null);
    setMetricEdits({});
    setExcludedTemplateIds({});
  }, [props.defaultDueDate, props.opened]);

  const previewQuery = useStudentFeeTemplates(props.studentId ?? undefined, {
    month: hasBillingMonth ? ym : undefined,
  });
  const challanPreviewMutation = useFeeChallanPreview(props.studentId);
  const individualTemplatesQuery = useFeeTemplates({ scope: 'Individual', isActive: 'true' });
  const linkTemplateMutation = useCreateFeeStudentTemplateLink();
  const updateLinkMutation = useUpdateFeeStudentTemplateLink();

  // When templates load, prefer the fee package’s due-by day of the fee month.
  useEffect(() => {
    if (!props.opened) return;
    if (!props.monthBounds) return;
    const templates = previewQuery.data?.templates ?? [];
    const feeTpl = templates.find((tpl) => tpl.type === 'Fee' && typeof tpl.daysUntilDue === 'number');
    if (!feeTpl) return;
    const dueDay = Math.min(31, Math.max(1, Math.floor(feeTpl.daysUntilDue)));
    const y = props.monthBounds.minDate.getFullYear();
    const m = props.monthBounds.minDate.getMonth();
    const lastDay = props.monthBounds.maxDate.getDate();
    setStudentDueDate(new Date(y, m, Math.min(dueDay, lastDay)));
  }, [props.opened, props.monthBounds, previewQuery.data?.templates]);
  const linkedIndividualTemplates = useMemo(() => {
    const templates = previewQuery.data?.templates ?? [];
    return templates.filter((tpl) => tpl.source === 'Individual' && tpl.linkId);
  }, [previewQuery.data?.templates]);

  const individualTemplateOptions = useMemo(() => {
    const list = (individualTemplatesQuery.data ?? []).filter((tpl) => tpl.scope === 'Individual');
    return list.map((tpl) => ({ value: tpl.id, label: tpl.name }));
  }, [individualTemplatesQuery.data]);

  const metricEditsPayload: FeeChallanMetricEdit[] = useMemo(() => {
    const templates = previewQuery.data?.templates ?? [];
    const templateByMetricId = new Map<string, string>();
    for (const tpl of templates) {
      for (const m of tpl.metrics) templateByMetricId.set(m.id, tpl.id);
    }

    const edits: FeeChallanMetricEdit[] = [];
    for (const [metricId, v] of Object.entries(metricEdits)) {
      const templateId = templateByMetricId.get(metricId);
      if (!templateId) continue;
      if (excludedTemplateIds[templateId]) continue;
      if (v.exclude) {
        edits.push({ templateId, metricId, action: 'exclude' });
      } else if (typeof v.overrideAmount === 'number') {
        edits.push({ templateId, metricId, action: 'overrideAmount', amount: v.overrideAmount });
      }
    }
    return edits;
  }, [excludedTemplateIds, metricEdits, previewQuery.data?.templates]);

  const templateEditsPayload: FeeChallanTemplateEdit[] = useMemo(() => {
    const templates = previewQuery.data?.templates ?? [];
    const edits: FeeChallanTemplateEdit[] = [];
    for (const tpl of templates) {
      if (excludedTemplateIds[tpl.id]) {
        edits.push({ templateId: tpl.id, action: 'exclude' });
      }
    }
    return edits;
  }, [excludedTemplateIds, previewQuery.data?.templates]);

  useEffect(() => {
    if (!props.opened) return;
    if (!hasBillingMonth) return;
    if (!props.studentId) return;
    if (metricEditsPayload.length === 0 && templateEditsPayload.length === 0) {
      challanPreviewMutation.reset();
      return;
    }
    void challanPreviewMutation.mutateAsync({
      month: ym,
      metricEdits: metricEditsPayload.length > 0 ? metricEditsPayload : undefined,
      templateEdits: templateEditsPayload.length > 0 ? templateEditsPayload : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBillingMonth, metricEditsPayload, props.opened, props.studentId, templateEditsPayload, ym]);

  const previewForMonth =
    previewQuery.data?.preview?.month === ym ? previewQuery.data.preview : undefined;
  const overridePreviewForMonth =
    challanPreviewMutation.data?.month === ym ? challanPreviewMutation.data : undefined;
  const awaitingPreview =
    hasBillingMonth &&
    !!props.studentId &&
    !previewQuery.isError &&
    previewForMonth === undefined &&
    (previewQuery.isFetching || previewQuery.isPending);

  const formBaselineInvalid =
    !props.studentId ||
    !hasBillingMonth ||
    !props.onConfirmGenerate ||
    !studentDueDate ||
    (billingStart !== null && studentDueDate !== null && billingStart > studentDueDate);

  return (
    <Modal
      opened={props.opened}
      onClose={props.onClose}
      title={props.studentName ?? t('challans.generateSingleTitle')}
      size="lg"
    >
      <Stack gap="md">
        {hasBillingMonth ? (
          <Text size="sm" c="dimmed">
            {t('challans.modalBillingMonth', { month: ym })}
          </Text>
        ) : (
          <Text c="dimmed">{t('challans.selectMonthHint')}</Text>
        )}

        <Paper withBorder radius="md" p="md">
          <Stack gap="md">
            <DatePickerInput
              id="fees-challans-billing-start"
              label={t('challans.billingStartLabel')}
              description={t('challans.billingStartDescription')}
              value={billingStart}
              onChange={setBillingStart}
              disabled={!hasBillingMonth}
              minDate={props.monthBounds?.minDate}
              maxDate={props.monthBounds?.maxDate}
              clearable
            />

            <DatePickerInput
              id="fees-challans-student-due-date"
              label={t('challans.studentDueDateLabel')}
              description={t('challans.studentDueDateDescription')}
              value={studentDueDate}
              onChange={setStudentDueDate}
              disabled={!hasBillingMonth}
              minDate={props.monthBounds?.minDate}
              maxDate={addCalendarDays(new Date(), 365)}
              clearable={false}
            />

            <Divider />

            <Stack gap="xs">
              <Text fw={600}>{t('challans.individualTemplatesTitle')}</Text>
              <Group align="flex-end" grow wrap="wrap">
                <Select
                  id="fees-challans-link-individual-template"
                  label={t('challans.individualTemplateLabel')}
                  placeholder={t('challans.individualTemplatePlaceholder')}
                  data={individualTemplateOptions}
                  value={selectedIndividualTemplateId}
                  onChange={setSelectedIndividualTemplateId}
                  searchable
                  disabled={!props.studentId || individualTemplatesQuery.isLoading}
                />
                <Button
                  id="fees-challans-link-individual-template-submit"
                  onClick={async () => {
                    if (!props.studentId || !selectedIndividualTemplateId) return;
                    await linkTemplateMutation.mutateAsync({
                      studentId: props.studentId,
                      templateId: selectedIndividualTemplateId,
                    });
                    setSelectedIndividualTemplateId(null);
                  }}
                  disabled={!props.studentId || !selectedIndividualTemplateId || linkTemplateMutation.isPending}
                  loading={!!selectedIndividualTemplateId && linkTemplateMutation.isPending}
                >
                  {t('challans.linkIndividualTemplate')}
                </Button>
              </Group>

              {linkedIndividualTemplates.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('challans.noIndividualTemplatesLinked')}
                </Text>
              ) : (
                <Stack gap={6}>
                  {linkedIndividualTemplates.map((tpl) => (
                    <Group key={tpl.id} justify="space-between" wrap="nowrap">
                      <Text size="sm">{tpl.name}</Text>
                      <Button
                        id={`fees-challans-unlink-individual-template-${tpl.linkId}`}
                        size="xs"
                        variant="light"
                        color="red"
                        onClick={async () => {
                          if (!tpl.linkId) return;
                          await updateLinkMutation.mutateAsync({
                            id: tpl.linkId,
                            studentId: props.studentId ?? '',
                            isActive: false,
                          });
                        }}
                        disabled={!tpl.linkId || updateLinkMutation.isPending}
                        loading={!!tpl.linkId && updateLinkMutation.isPending}
                      >
                        {t('challans.unlinkIndividualTemplate')}
                      </Button>
                    </Group>
                  ))}
                </Stack>
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Stack gap="xs">
            <Text fw={600}>{t('challans.adjustForThisChallanTitle')}</Text>
            {(previewQuery.data?.templates ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">
                {t('challans.noTemplatesToAdjust')}
              </Text>
            ) : (
              <Stack gap="sm">
                {(previewQuery.data?.templates ?? []).map((tpl) => (
                  <Stack key={tpl.id} gap={6}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Text size="sm" fw={600}>
                        {tpl.name}
                      </Text>
                      <Checkbox
                        id={`fees-challans-edit-template-${tpl.id}-exclude`}
                        label={t('challans.excludeTemplate')}
                        checked={!!excludedTemplateIds[tpl.id]}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setExcludedTemplateIds((prev) => ({ ...prev, [tpl.id]: checked }));
                        }}
                      />
                    </Group>
                    <Table withRowBorders={false} verticalSpacing="xs">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('challans.metric')}</Table.Th>
                          <Table.Th style={{ width: '1%', whiteSpace: 'nowrap' }}>{t('challans.exclude')}</Table.Th>
                          <Table.Th style={{ width: 180 }}>{t('challans.overrideAmount')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {tpl.metrics.map((m) => {
                          const current = metricEdits[m.id] ?? { exclude: false, overrideAmount: null };
                          const isExcluded = current.exclude;
                          const templateExcluded = !!excludedTemplateIds[tpl.id];
                          const canOverride = m.amountType === 'Absolute' && !isExcluded && !templateExcluded;
                          return (
                            <Table.Tr key={m.id}>
                              <Table.Td>
                                <Text size="sm">
                                  {m.name} <Text span c="dimmed">({m.amount.toLocaleString()})</Text>
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Checkbox
                                  id={`fees-challans-edit-metric-${m.id}-exclude`}
                                  checked={isExcluded}
                                  onChange={(e) => {
                                    const checked = e.currentTarget.checked;
                                    setMetricEdits((prev) => ({
                                      ...prev,
                                      [m.id]: {
                                        exclude: checked,
                                        overrideAmount: checked ? null : prev[m.id]?.overrideAmount ?? null,
                                      },
                                    }));
                                  }}
                                  disabled={templateExcluded}
                                />
                              </Table.Td>
                              <Table.Td>
                                <NumberInput
                                  id={`fees-challans-edit-metric-${m.id}-amount`}
                                  value={current.overrideAmount ?? undefined}
                                  onChange={(v) => {
                                    const num = typeof v === 'number' ? v : null;
                                    setMetricEdits((prev) => ({
                                      ...prev,
                                      [m.id]: { exclude: prev[m.id]?.exclude ?? false, overrideAmount: num },
                                    }));
                                  }}
                                  disabled={!canOverride}
                                  min={0}
                                  placeholder={t('challans.overrideAmountPlaceholder')}
                                />
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        {/* Fee breakdown moved to the end */}
        <Paper withBorder radius="md" p="md">
          {!hasBillingMonth ? (
            <Text c="dimmed">{t('challans.selectMonthHint')}</Text>
          ) : awaitingPreview || challanPreviewMutation.isPending ? (
            <Skeleton height={160} />
          ) : overridePreviewForMonth ?? previewForMonth ? (
            <Stack gap="xs">
              <Text fw={600}>
                {t('challans.breakdownTitle', { month: (overridePreviewForMonth ?? previewForMonth)!.month })}
              </Text>
              <Table>
                <Table.Tbody>
                  {(overridePreviewForMonth ?? previewForMonth)!.items.map((it, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{it.description}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{it.amount.toLocaleString()}</Table.Td>
                    </Table.Tr>
                  ))}
                  <Table.Tr>
                    <Table.Td>{t('challans.total')}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {(overridePreviewForMonth ?? previewForMonth)!.payableAmount.toLocaleString()}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          ) : (
            <Text c="dimmed">{t('challans.noPreview')}</Text>
          )}
        </Paper>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={props.onClose} disabled={props.generateMutationPending}>
            {t('common.cancel')}
          </Button>
          <Button
            id="fees-challans-single-generate"
            onClick={() => {
              if (!props.onConfirmGenerate) return;
              if (!studentDueDate) return;
              const billing =
                billingStart
                  ? {
                      billingStartDate: toIsoDateOrNull(billingStart) ?? undefined,
                      billingEndDate: toLocalIsoDate(studentDueDate),
                    }
                  : undefined;
              void props.onConfirmGenerate(toLocalIsoDate(studentDueDate), {
                metricEdits: metricEditsPayload,
                templateEdits: templateEditsPayload,
              }, billing);
            }}
            disabled={formBaselineInvalid}
            loading={props.generateMutationPending && !formBaselineInvalid}
          >
            {t('challans.generateChallan')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

