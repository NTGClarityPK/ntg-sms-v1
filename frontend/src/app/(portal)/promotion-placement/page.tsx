'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Group, Paper, Select, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useActiveAcademicYear, useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useClassSections } from '@/hooks/useClassSections';
import { usePromotionStudents, useSavePromotionDecisions, useYearCloseReadiness } from '@/hooks/usePromotionPlacement';
import type { PromotionOutcome, PromotionStudent } from '@/types/promotion-placement';
import { useClasses, useSections } from '@/hooks/useCoreLookups';

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
    readinessQuery.isLoading;

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
  };

  const handleSave = async () => {
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
      await saveMutation.mutateAsync({ sourceAcademicYearId: academicYearId, decisions });
      notifications.show({
        title: 'Success',
        message: 'Promotion decisions saved',
        color: notifyColors.success,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save promotion decisions';
      notifications.show({ title: 'Error', message: msg, color: notifyColors.error });
    }
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{tNav('promotionPlacement')}</Title>
          <Button onClick={handleSave} loading={saveMutation.isPending} disabled={!academicYearId}>
            Save
          </Button>
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
              {readiness && readiness.decisionsMissing > 0 && (
                <Alert color={colors.warning} title="Year close readiness">
                  <Text size="sm">
                    {readiness.decisionsMissing} student(s) are missing Promotion & Placement decisions. Academic year
                    lock/rollover will be blocked until completed.
                  </Text>
                </Alert>
              )}

              <Paper withBorder p="md">
                <Group grow align="flex-end">
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
                <Group>
                  <Button variant="light" onClick={() => bulkSetOutcome('promoted')} disabled={students.length === 0}>
                    Promote all
                  </Button>
                  <Button variant="light" onClick={() => bulkSetOutcome('repeated')} disabled={students.length === 0}>
                    Repeat all
                  </Button>
                  <Button variant="light" onClick={() => bulkSetOutcome('graduated')} disabled={students.length === 0}>
                    Graduate all
                  </Button>
                </Group>
              </Paper>

              <Paper withBorder p="md">
                {studentsQuery.error ? (
                  <Alert color={colors.error} title="Failed to load students">
                    <Text size="sm">Please try again.</Text>
                  </Alert>
                ) : students.length === 0 ? (
                  <Text c="dimmed">No active students found for the selected year/class-section.</Text>
                ) : (
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
                              disabled={!draft[s.id] || draft[s.id]?.outcome !== 'promoted'}
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
                              disabled={!draft[s.id] || draft[s.id]?.outcome !== 'promoted'}
                              placeholder="Select section"
                              searchable
                              clearable
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
            </>
          )}
        </Stack>
      </div>
    </>
  );
}

