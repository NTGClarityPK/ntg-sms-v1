'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  Modal,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { PAGE_TITLE_BAR_MOBILE_MEDIA } from '@/components/common/PageTitleBarLongTitleSizing';
import { notifications } from '@mantine/notifications';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useActiveAcademicYear, useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useClassSections } from '@/hooks/useClassSections';
import { usePromotionStudents, useSavePromotionDecisions, useYearCloseReadiness, usePromotionWindow } from '@/hooks/usePromotionPlacement';
import type { PromotionOutcome, PromotionStudent } from '@/types/promotion-placement';
import { useClasses, useSections } from '@/hooks/useCoreLookups';
import { IconLock, IconAlertTriangle } from '@tabler/icons-react';

function fullName(s: PromotionStudent): string {
  return [s.firstName, s.lastName].filter(Boolean).join(' ') || s.studentId || s.id;
}

function buildClassSectionLabel(input: {
  classId?: string;
  sectionId?: string;
  className?: string;
  sectionName?: string;
}): string {
  const classLabel = input.className || '—';
  const sectionLabel = input.sectionName || '—';
  if (!input.classId && !input.sectionId && !input.className && !input.sectionName) return '—';
  return `${classLabel} - ${sectionLabel}`;
}

export default function PromotionPlacementPage() {
  const tNav = useTranslations('navigation');
  const isMobile = useMediaQuery(PAGE_TITLE_BAR_MOBILE_MEDIA);
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();

  const { data: activeYearRes } = useActiveAcademicYear();
  const activeYearId = activeYearRes?.data?.id ?? null;

  const yearsQuery = useAcademicYearsList({ page: 1, limit: 100, search: '' });
  const years = yearsQuery.data?.data ?? [];

  const [academicYearId, setAcademicYearId] = useState<string | null>(activeYearId);
  useEffect(() => {
    if (!academicYearId && activeYearId) setAcademicYearId(activeYearId);
  }, [academicYearId, activeYearId]);

  const windowQuery = usePromotionWindow(academicYearId);
  const windowStatus = windowQuery.data?.data ?? null;

  const classSectionsQuery = useClassSections(
    academicYearId ? { isActive: true, minimal: true, academicYearId } : undefined,
  );
  const classSections = classSectionsQuery.data?.data ?? [];
  const classSectionOptions = useMemo(
    () =>
      classSections.map((cs) => ({
        value: cs.id,
        label: `${cs.classDisplayName || cs.className || 'Class'} - ${cs.sectionName || 'Section'}`,
      })),
    [classSections],
  );

  const [classSectionId, setClassSectionId] = useState<string | null>(null);

  const studentsQuery = usePromotionStudents({ academicYearId, classSectionId });
  const students = studentsQuery.data?.data ?? [];

  const readinessQuery = useYearCloseReadiness(academicYearId);
  const readiness = readinessQuery.data?.data ?? null;

  const saveMutation = useSavePromotionDecisions();
  const classesQuery = useClasses();
  const sectionsQuery = useSections();
  const classes = classesQuery.data?.data ?? [];
  const sections = sectionsQuery.data?.data ?? [];

  const nextClassIdByClassId = useMemo(() => {
    const active = classes.filter((c) => c.isActive);
    const bySort = [...active].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return (a.displayName || a.name).localeCompare(b.displayName || b.name);
    });
    const indexById = new Map<string, number>();
    bySort.forEach((c, idx) => indexById.set(c.id, idx));

    const nextById = new Map<string, string | null>();
    for (const c of bySort) {
      const idx = indexById.get(c.id);
      if (idx === undefined) continue;
      const next = bySort[idx + 1];
      nextById.set(c.id, next?.id ?? null);
    }
    return nextById;
  }, [classes]);

  const classNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) {
      m.set(c.id, c.displayName || c.name);
    }
    return m;
  }, [classes]);

  const sectionNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) {
      m.set(s.id, s.name);
    }
    return m;
  }, [sections]);

  const classOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: c.displayName || c.name,
      })),
    [classes],
  );
  const sectionOptions = useMemo(
    () =>
      sections.map((s) => ({
        value: s.id,
        label: s.name,
      })),
    [sections],
  );

  // Local editable state: studentId -> decision
  const [draft, setDraft] = useState<
    Record<
      string,
      { outcome: PromotionOutcome; targetClassId?: string | null; targetSectionId?: string | null }
    >
  >({});

  useEffect(() => {
    const next: typeof draft = {};
    for (const s of students) {
      if (s.decisionOutcome) {
        next[s.id] = {
          outcome: s.decisionOutcome,
          targetClassId: s.targetClassId ?? null,
          targetSectionId: s.targetSectionId ?? null,
        };
      }
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsQuery.data?.data]);

  // Track whether a bulk action was used since last Save
  const [bulkActionUsed, setBulkActionUsed] = useState(false);

  const outcomeOptions: Array<{ value: PromotionOutcome; label: string }> = [
    { value: 'promoted', label: 'Promoted' },
    { value: 'repeated', label: 'Repeated' },
    { value: 'graduated', label: 'Graduated' },
    { value: 'transferred_out', label: 'Transferred out' },
    { value: 'withdrawn', label: 'Withdrawn' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const isLoading =
    yearsQuery.isLoading ||
    classSectionsQuery.isLoading ||
    studentsQuery.isLoading ||
    readinessQuery.isLoading ||
    windowQuery.isLoading;

  // Whether controls are interactable
  const windowOpen = windowStatus?.open ?? true; // default permissive while loading
  const moduleEnabled = windowStatus?.enabled ?? true;
  const controlsDisabled = !moduleEnabled || !windowOpen;

  const bulkSetOutcome = (outcome: PromotionOutcome) => {
    const next = { ...draft };
    for (const s of students) {
      const existing = next[s.id];
      next[s.id] = {
        outcome,
        targetClassId:
          outcome === 'repeated'
            ? s.classId ?? null
            : outcome === 'promoted'
              ? existing?.outcome === 'promoted'
                ? (existing.targetClassId ?? null)
                : (s.classId ? (nextClassIdByClassId.get(s.classId) ?? null) : null)
              : null,
        targetSectionId:
          outcome === 'repeated'
            ? s.sectionId ?? null
            : outcome === 'promoted'
              ? existing?.outcome === 'promoted'
                ? (existing.targetSectionId ?? null)
                : (s.sectionId ?? null)
              : null,
      };
    }
    setDraft(next);
    setBulkActionUsed(true);
  };

  // Graduate-all confirmation modal state
  const [graduateConfirmOpened, graduateConfirmHandlers] = useDisclosure(false);
  const [graduateConfirmText, setGraduateConfirmText] = useState('');

  const selectedClassSectionLabel = useMemo(() => {
    if (!classSectionId) return '';
    const opt = classSectionOptions.find((o) => o.value === classSectionId);
    return opt?.label ?? '';
  }, [classSectionId, classSectionOptions]);

  const handleGraduateAllClick = () => {
    setGraduateConfirmText('');
    graduateConfirmHandlers.open();
  };

  const handleGraduateAllConfirm = () => {
    bulkSetOutcome('graduated');
    graduateConfirmHandlers.close();
  };

  // Save confirmation modal state
  const [saveConfirmOpened, saveConfirmHandlers] = useDisclosure(false);

  const draftSummary = useMemo(() => {
    const counts: Partial<Record<PromotionOutcome, number>> = {};
    for (const d of Object.values(draft)) {
      counts[d.outcome] = (counts[d.outcome] ?? 0) + 1;
    }
    return counts;
  }, [draft]);

  const handleSaveClick = () => {
    if (!academicYearId) return;
    if (bulkActionUsed) {
      saveConfirmHandlers.open();
    } else {
      void performSave();
    }
  };

  const performSave = async () => {
    if (!academicYearId) return;

    const missingTargets = Object.entries(draft)
      .filter(([, d]) => d.outcome === 'promoted' || d.outcome === 'repeated')
      .filter(([, d]) => !d.targetClassId || !d.targetSectionId)
      .map(([studentId]) => studentId);

    if (missingTargets.length > 0) {
      notifications.show({
        title: 'Missing target placement',
        message: `Please select Target Class and Target Section for ${missingTargets.length} student(s) marked Promoted/Repeated.`,
        color: notifyColors.error,
      });
      return;
    }

    const decisions = Object.entries(draft).map(([studentId, d]) => ({
      studentId,
      outcome: d.outcome,
      targetClassId: d.targetClassId ?? null,
      targetSectionId: d.targetSectionId ?? null,
    }));

    try {
      await saveMutation.mutateAsync({
        sourceAcademicYearId: academicYearId,
        decisions,
        classSectionId: classSectionId ?? null,
      });
      notifications.show({
        title: 'Success',
        message: 'Promotion decisions saved',
        color: notifyColors.success,
      });
      setBulkActionUsed(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save promotion decisions';
      notifications.show({ title: 'Error', message: msg, color: notifyColors.error });
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%" wrap="nowrap" align="center" gap="xs">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={isMobile ? 2 : 1}>
            {tNav('promotionPlacement')}
          </Title>
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
          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={40} />
              <Skeleton height={360} />
            </Stack>
          ) : (
            <>
              {/* Module disabled notice */}
              {!moduleEnabled && (
                <Alert color="red" icon={<IconLock size={16} />} title="Promotion & Placement is disabled">
                  <Text size="sm">
                    This module has been disabled by an administrator. Go to Settings → Promotion &amp; Placement to
                    re-enable it.
                  </Text>
                </Alert>
              )}

              {/* Window not open notice */}
              {moduleEnabled && !windowOpen && (
                <Alert color={colors.warning} icon={<IconAlertTriangle size={16} />} title="Promotion window not open">
                  <Text size="sm">
                    {windowStatus?.opensOn
                      ? `Saving promotion decisions is not allowed yet. The window opens on ${windowStatus.opensOn}.`
                      : 'Saving promotion decisions is not allowed yet.'}
                    {' '}Contact an admin to force-open the window early in Settings.
                  </Text>
                </Alert>
              )}

              {/* Readiness warning */}
              {readiness && readiness.decisionsMissing > 0 && (
                <Alert color={colors.warning} title="Year close readiness">
                  <Text size="sm">
                    {readiness.decisionsMissing} student(s) are missing Promotion & Placement decisions. Academic year
                    lock/rollover will be blocked until completed.
                  </Text>
                </Alert>
              )}

              <Paper withBorder p="md">
                <Group grow={!isMobile} align="flex-end">
                  <Select
                    label="Academic year"
                    data={years.map((y) => ({ value: y.id, label: y.name }))}
                    value={academicYearId}
                    onChange={setAcademicYearId}
                    searchable
                  />
                  <Select
                    label="Class-section"
                    data={classSectionOptions}
                    value={classSectionId}
                    onChange={setClassSectionId}
                    placeholder="Select class-section"
                    clearable
                    searchable
                  />
                </Group>
              </Paper>

              <Paper withBorder p="md">
                <Group justify="space-between" w="100%" wrap="wrap" gap="xs" align="center">
                  <Group wrap="wrap" gap="xs">
                    {/* Promote all / Repeat all: require class-section selection */}
                    <Button
                      variant="light"
                      onClick={() => bulkSetOutcome('promoted')}
                      disabled={controlsDisabled || students.length === 0 || !classSectionId}
                      title={!classSectionId ? 'Select a class-section first to use bulk actions' : undefined}
                    >
                      Promote all
                    </Button>
                    <Button
                      variant="light"
                      onClick={() => bulkSetOutcome('repeated')}
                      disabled={controlsDisabled || students.length === 0 || !classSectionId}
                      title={!classSectionId ? 'Select a class-section first to use bulk actions' : undefined}
                    >
                      Repeat all
                    </Button>
                    {/* Graduate all: requires class-section + typed confirmation */}
                    <Button
                      variant="light"
                      color="red"
                      onClick={handleGraduateAllClick}
                      disabled={controlsDisabled || students.length === 0 || !classSectionId}
                      title={!classSectionId ? 'Select a class-section first to use Graduate all' : undefined}
                    >
                      Graduate all
                    </Button>
                  </Group>
                  <Box style={{ flexShrink: 0 }}>
                    <Button
                      id="promotion-placement-btn-save"
                      onClick={handleSaveClick}
                      loading={!!academicYearId && saveMutation.isPending}
                      disabled={!academicYearId || controlsDisabled}
                    >
                      Save
                    </Button>
                  </Box>
                </Group>
                {!classSectionId && students.length > 0 && (
                  <Text size="xs" c="dimmed" mt="xs">
                    Select a class-section to enable bulk actions (Promote all, Repeat all, Graduate all).
                  </Text>
                )}
              </Paper>

              <Paper withBorder p="md" style={{ overflow: 'hidden' }}>
                {studentsQuery.error ? (
                  <Alert color={colors.error} title="Failed to load students">
                    <Text size="sm">Please try again.</Text>
                  </Alert>
                ) : students.length === 0 ? (
                  <Text c="dimmed">No active students found for the selected year/class-section.</Text>
                ) : (
                  <Table.ScrollContainer minWidth={880}>
                    <Table withTableBorder withColumnBorders striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Student</Table.Th>
                        <Table.Th>Current class-section</Table.Th>
                        <Table.Th>Outcome</Table.Th>
                        <Table.Th>Target class</Table.Th>
                        <Table.Th>Target section</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {students.map((s) => (
                        <Table.Tr key={s.id}>
                          <Table.Td>
                            <Text fw={600}>{fullName(s)}</Text>
                            <Text size="xs" c="dimmed">
                              {s.studentId}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {buildClassSectionLabel({
                                classId: s.classId,
                                sectionId: s.sectionId,
                                className: s.classId ? classNameById.get(s.classId) : undefined,
                                sectionName: s.sectionId ? sectionNameById.get(s.sectionId) : undefined,
                              })}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Select
                              data={outcomeOptions}
                              value={draft[s.id]?.outcome ?? null}
                              onChange={(v) => {
                                if (!v) return;
                                const outcome = v as PromotionOutcome;
                                setDraft((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    outcome,
                                    targetClassId:
                                      outcome === 'repeated'
                                        ? s.classId ?? null
                                        : outcome === 'promoted'
                                          ? (s.classId ? (nextClassIdByClassId.get(s.classId) ?? null) : null)
                                          : null,
                                    targetSectionId:
                                      outcome === 'repeated'
                                        ? s.sectionId ?? null
                                        : outcome === 'promoted'
                                          ? (s.sectionId ?? null)
                                          : null,
                                  },
                                }));
                              }}
                              placeholder="Select outcome"
                              searchable
                              disabled={controlsDisabled}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Select
                              data={classOptions}
                              value={draft[s.id]?.targetClassId ?? null}
                              onChange={(v) => {
                                setDraft((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    outcome: prev[s.id]?.outcome ?? 'promoted',
                                    targetClassId: v ?? null,
                                    targetSectionId: prev[s.id]?.targetSectionId ?? null,
                                  },
                                }));
                              }}
                              disabled={controlsDisabled || !draft[s.id] || draft[s.id]?.outcome !== 'promoted'}
                              placeholder="Select class"
                              searchable
                              clearable
                            />
                          </Table.Td>
                          <Table.Td>
                            <Select
                              data={sectionOptions}
                              value={draft[s.id]?.targetSectionId ?? null}
                              onChange={(v) => {
                                setDraft((prev) => ({
                                  ...prev,
                                  [s.id]: {
                                    outcome: prev[s.id]?.outcome ?? 'promoted',
                                    targetClassId: prev[s.id]?.targetClassId ?? null,
                                    targetSectionId: v ?? null,
                                  },
                                }));
                              }}
                              disabled={controlsDisabled || !draft[s.id] || draft[s.id]?.outcome !== 'promoted'}
                              placeholder="Select section"
                              searchable
                              clearable
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                )}
              </Paper>
            </>
          )}
        </Stack>
      </div>

      {/* Graduate all confirmation modal */}
      <Modal
        opened={graduateConfirmOpened}
        onClose={graduateConfirmHandlers.close}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
            <Text fw={600} c="red">Graduate entire class?</Text>
          </Group>
        }
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            This will mark all <strong>{students.length}</strong> students in{' '}
            <strong>{selectedClassSectionLabel}</strong> as <strong>Graduated</strong>.
          </Text>
          <Alert color="red" icon={<IconAlertTriangle size={14} />}>
            <Text size="sm">
              This updates student placement immediately when saved. There is no automatic undo.
            </Text>
          </Alert>
          <TextInput
            id="graduate-confirm-input"
            label={`Type the class-section name to confirm`}
            placeholder={selectedClassSectionLabel}
            value={graduateConfirmText}
            onChange={(e) => setGraduateConfirmText(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={graduateConfirmHandlers.close}>Cancel</Button>
            <Button
              id="graduate-confirm-btn"
              color="red"
              disabled={graduateConfirmText.trim() !== selectedClassSectionLabel.trim()}
              onClick={handleGraduateAllConfirm}
            >
              Graduate all
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Save confirmation modal (shown when bulk action was used) */}
      <Modal
        opened={saveConfirmOpened}
        onClose={saveConfirmHandlers.close}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
            <Text fw={600}>Confirm promotion decisions</Text>
          </Group>
        }
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            You are about to save promotion decisions for <strong>{Object.keys(draft).length}</strong> students.
          </Text>
          <Paper withBorder p="sm">
            <Stack gap={4}>
              {Object.entries(draftSummary).map(([outcome, count]) => (
                <Group key={outcome} justify="space-between">
                  <Text size="sm" tt="capitalize">{outcome.replace('_', ' ')}</Text>
                  <Text size="sm" fw={600}>{count}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
          <Alert color="orange" icon={<IconAlertTriangle size={14} />}>
            <Text size="sm">
              This updates student placement immediately and cannot be undone without admin support.
            </Text>
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={saveConfirmHandlers.close}>Cancel</Button>
            <Button
              id="save-decisions-confirm-btn"
              loading={saveMutation.isPending}
              onClick={async () => {
                saveConfirmHandlers.close();
                await performSave();
              }}
            >
              Save decisions
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
