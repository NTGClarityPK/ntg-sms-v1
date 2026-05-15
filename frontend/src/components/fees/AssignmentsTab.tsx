'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { useClassSections } from '@/hooks/useClassSections';
import { useStudents } from '@/hooks/useStudents';
import {
  useCreateFeeMetricExclusion,
  useCreateFeeStudentTemplateLink,
  useDeleteFeeMetricExclusion,
  useFeeTemplates,
  useStudentFeeTemplates,
  useUpdateFeeStudentTemplateLink,
} from '@/hooks/api/useFees';
import type { FeeStudentTemplate, FeeTemplate } from '@/types/fees';

function isValidMonth(m: string) {
  return /^[0-9]{4}-[0-9]{2}$/.test(m);
}

export function AssignmentsTab() {
  const t = useTranslations('fees');

  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const [detailsStudent, setDetailsStudent] = useState<null | { id: string; name: string }>(null);
  const [previewMonth, setPreviewMonth] = useState('');

  const classSectionsQuery = useClassSections({ page: 1, limit: 200, minimal: true, isActive: true });
  const selectedClassSection = useMemo(() => {
    const list = classSectionsQuery.data?.data ?? [];
    return classSectionId ? list.find((cs) => cs.id === classSectionId) ?? null : null;
  }, [classSectionId, classSectionsQuery.data?.data]);

  const studentsQuery = useStudents({
    page: 1,
    limit: 200,
    search: studentSearch,
    isActive: true,
    classIds: selectedClassSection?.classId ? [selectedClassSection.classId] : undefined,
    sectionIds: selectedClassSection?.sectionId ? [selectedClassSection.sectionId] : undefined,
  });

  const students = studentsQuery.data?.data ?? [];

  const isMonthValid = !previewMonth.trim() || isValidMonth(previewMonth.trim());
  const detailsQuery = useStudentFeeTemplates(detailsStudent?.id ?? undefined, {
    month: previewMonth.trim() ? previewMonth.trim() : undefined,
  });

  const individualTemplatesQuery = useFeeTemplates({ scope: 'Individual', isActive: 'true' });
  const createLink = useCreateFeeStudentTemplateLink();
  const updateLink = useUpdateFeeStudentTemplateLink();

  const createExclusion = useCreateFeeMetricExclusion();
  const deleteExclusion = useDeleteFeeMetricExclusion();

  const exclusionByMetricId = useMemo(() => {
    const map = new Map<string, string>();
    const exclusions = detailsQuery.data?.exclusions ?? [];
    exclusions.forEach((e) => map.set(e.metricId, e.id));
    return map;
  }, [detailsQuery.data?.exclusions]);

  const classSectionOptions = useMemo(() => {
    const list = classSectionsQuery.data?.data ?? [];
    return list.map((cs) => ({
      value: cs.id,
      label: `${cs.classDisplayName ?? cs.className ?? ''}-${cs.sectionName ?? ''}`.replace('--', '-').trim(),
    }));
  }, [classSectionsQuery.data?.data]);

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Text fw={600}>{t('tabs.assignments')}</Text>
        <Button
          id="fees-assignments-refresh"
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={() => detailsQuery.refetch()}
          disabled={!detailsStudent}
          loading={detailsQuery.isFetching}
        >
          {t('assignments.refresh')}
        </Button>
      </Group>

      <Select
        id="fees-assignments-class-section"
        label={t('assignments.filterClassSectionLabel')}
        placeholder={t('assignments.filterClassSectionPlaceholder')}
        data={classSectionOptions}
        value={classSectionId}
        onChange={setClassSectionId}
        searchable
        nothingFoundMessage={classSectionsQuery.isLoading ? t('assignments.loadingClasses') : t('assignments.noClassesFound')}
      />

      <TextInput
        id="fees-assignments-search"
        label={t('assignments.searchLabel')}
        placeholder={t('assignments.searchPlaceholder')}
        value={studentSearch}
        onChange={(e) => setStudentSearch(e.currentTarget.value)}
      />

      {studentsQuery.isLoading ? (
        <Stack gap="xs">
          <Skeleton height={18} width="30%" />
          <Skeleton height={200} />
        </Stack>
      ) : studentsQuery.error ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title={t('assignments.studentsLoadErrorTitle')}>
          {t('assignments.studentsLoadErrorMessage')}
        </Alert>
      ) : students.length === 0 ? (
        <Text c="dimmed">{t('assignments.noStudentsInFilter')}</Text>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('assignments.studentTable.student')}</Table.Th>
              <Table.Th>{t('assignments.studentTable.actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {students.map((s) => {
              const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || '—';
              return (
                <Table.Tr key={s.id}>
                  <Table.Td>{name}</Table.Td>
                  <Table.Td>
                    <Button
                      id={`fees-assignments-view-${s.id}`}
                      size="xs"
                      variant="light"
                      onClick={() => {
                        setPreviewMonth('');
                        setDetailsStudent({ id: s.id, name });
                      }}
                    >
                      {t('assignments.viewDetails')}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <StudentFeeDetailsModal
        opened={!!detailsStudent}
        onClose={() => setDetailsStudent(null)}
        student={detailsStudent}
        previewMonth={previewMonth}
        setPreviewMonth={setPreviewMonth}
        isMonthValid={isMonthValid}
        data={detailsQuery.data}
        isLoading={detailsQuery.isLoading}
        error={detailsQuery.error}
        exclusionByMetricId={exclusionByMetricId}
        onToggleMetric={async (studentId, templateId, metricId, checked) => {
          if (!studentId) return;
          const exclusionId = exclusionByMetricId.get(metricId);
          if (!checked) {
            await createExclusion.mutateAsync({ studentId, templateId, metricId });
          } else if (exclusionId) {
            await deleteExclusion.mutateAsync({ id: exclusionId, studentId });
          }
        }}
        individualTemplates={(individualTemplatesQuery.data ?? []) as FeeTemplate[]}
        onLinkTemplate={async (studentId, templateId, startDate, endDate) => {
          await createLink.mutateAsync({ studentId, templateId, startDate, endDate });
        }}
        onRemoveLinkedTemplate={async (studentId, linkId) => {
          await updateLink.mutateAsync({ id: linkId, studentId, isActive: false });
        }}
        mutations={{
          linking: createLink.isPending,
          removing: updateLink.isPending,
          togglingMetric: createExclusion.isPending || deleteExclusion.isPending,
        }}
      />
    </Stack>
  );
}

function StudentFeeDetailsModal(props: {
  opened: boolean;
  onClose: () => void;
  student: { id: string; name: string } | null;
  previewMonth: string;
  setPreviewMonth: (v: string) => void;
  isMonthValid: boolean;
  data: any;
  isLoading: boolean;
  error: unknown;
  exclusionByMetricId: Map<string, string>;
  onToggleMetric: (studentId: string, templateId: string, metricId: string, checked: boolean) => Promise<void>;
  individualTemplates: FeeTemplate[];
  onLinkTemplate: (studentId: string, templateId: string, startDate?: string, endDate?: string) => Promise<void>;
  onRemoveLinkedTemplate: (studentId: string, linkId: string) => Promise<void>;
  mutations: { linking: boolean; removing: boolean; togglingMetric: boolean };
}) {
  const t = useTranslations('fees');
  const studentId = props.student?.id ?? null;

  const [linkOpened, setLinkOpened] = useState(false);
  const [linkTemplateId, setLinkTemplateId] = useState<string | null>(null);

  const templates: FeeStudentTemplate[] = props.data?.templates ?? [];
  const inherited = templates.filter((x) => x.source === 'Inherited');
  const individual = templates.filter((x) => x.source === 'Individual' || x.source === 'Auto');

  return (
    <>
      <Modal opened={props.opened} onClose={props.onClose} title={props.student?.name ?? t('assignments.detailsTitle')} size="xl">
        <Stack gap="md">
          <TextInput
            id="fees-assignments-preview-month"
            label={t('assignments.monthLabel')}
            description={t('assignments.monthDescription')}
            placeholder={t('assignments.monthPlaceholder')}
            value={props.previewMonth}
            onChange={(e) => props.setPreviewMonth(e.currentTarget.value)}
            error={!props.isMonthValid ? t('assignments.invalidMonth') : undefined}
          />

          {props.isLoading ? (
            <Stack gap="xs">
              <Skeleton height={18} width="30%" />
              <Skeleton height={240} />
            </Stack>
          ) : props.error ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" title={t('assignments.loadErrorTitle')}>
              {t('assignments.loadErrorMessage')}
            </Alert>
          ) : !props.data ? null : (
            <>
              <Stack gap="xs">
                <Text fw={600}>{t('assignments.linkedTemplatesTitle')}</Text>
                {inherited.length === 0 ? (
                  <Text c="dimmed">{t('assignments.noLinkedTemplates')}</Text>
                ) : (
                  inherited.map((tpl) => (
                    <Stack key={tpl.id} gap="xs">
                      <Group justify="space-between">
                        <Text fw={600}>{tpl.name}</Text>
                        <Text size="sm" c="dimmed">
                          {tpl.scope}
                        </Text>
                      </Group>
                      {tpl.metrics.map((m) => (
                        <Checkbox
                          key={m.id}
                          id={`fees-assignments-metric-${tpl.id}-${m.id}`}
                          label={`${m.name} — ${m.amountType === 'Percentage' ? `${m.amount}%` : m.amount.toLocaleString()}`}
                          checked={!m.isExcluded}
                          disabled={props.mutations.togglingMetric || !studentId}
                          onChange={async (e) => {
                            if (!studentId) return;
                            await props.onToggleMetric(studentId, tpl.id, m.id, e.currentTarget.checked);
                          }}
                        />
                      ))}
                      <Divider />
                    </Stack>
                  ))
                )}
              </Stack>

              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>{t('assignments.individualTemplatesTitle')}</Text>
                  <Button id="fees-assignments-link-template" leftSection={<IconPlus size={16} />} onClick={() => setLinkOpened(true)}>
                    {t('assignments.linkIndividualTemplate')}
                  </Button>
                </Group>

                {individual.length === 0 ? (
                  <Text c="dimmed">{t('assignments.noIndividualTemplates')}</Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('assignments.individualTable.template')}</Table.Th>
                        <Table.Th>{t('assignments.individualTable.type')}</Table.Th>
                        <Table.Th>{t('assignments.individualTable.actions')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {individual.map((tpl) => (
                        <Table.Tr key={tpl.id}>
                          <Table.Td>
                            <Group gap="xs">
                              <Text>{tpl.name}</Text>
                              {tpl.source === 'Auto' ? <Badge size="sm">{t('assignments.autoApplied')}</Badge> : null}
                              {tpl.linkStartDate && tpl.linkEndDate ? (
                                <Badge size="sm" variant="light">
                                  {tpl.linkStartDate} → {tpl.linkEndDate}
                                </Badge>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td>{tpl.type}</Table.Td>
                          <Table.Td>
                            {tpl.source === 'Individual' && tpl.linkId && studentId ? (
                              <Button
                                id={`fees-assignments-remove-${tpl.id}`}
                                size="xs"
                                variant="light"
                                color="red"
                                leftSection={<IconTrash size={16} />}
                                loading={props.mutations.removing}
                                onClick={() => props.onRemoveLinkedTemplate(studentId, tpl.linkId as string)}
                              >
                                {t('assignments.removeTemplate')}
                              </Button>
                            ) : (
                              <Text c="dimmed" size="sm">
                                {tpl.source === 'Auto' ? t('assignments.autoAppliedHint') : '—'}
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>

              {props.data.preview ? (
                <Stack gap="xs">
                  <Text fw={600}>{t('assignments.previewTitle', { month: props.data.preview.month })}</Text>
                  <Text>{t('assignments.previewTotal', { total: props.data.preview.payableAmount.toLocaleString() })}</Text>
                </Stack>
              ) : null}
            </>
          )}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={props.onClose}>
              {t('common.cancel')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={linkOpened} onClose={() => setLinkOpened(false)} title={t('assignments.linkIndividualTemplate')} size="lg">
        <Stack>
          <Select
            id="fees-assignments-link-template-select"
            label={t('assignments.linkTemplateLabel')}
            placeholder={t('assignments.linkTemplatePlaceholder')}
            data={props.individualTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
            value={linkTemplateId}
            onChange={setLinkTemplateId}
            searchable
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setLinkOpened(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              id="fees-assignments-link-confirm"
              loading={props.mutations.linking}
              disabled={!studentId || !linkTemplateId}
              onClick={async () => {
                if (!studentId || !linkTemplateId) return;
                await props.onLinkTemplate(studentId, linkTemplateId);
                setLinkOpened(false);
                setLinkTemplateId(null);
              }}
            >
              {t('assignments.link')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

