'use client';

import { Alert, Button, Group, MultiSelect, Paper, Select, Stack, Table, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useAssignGradeTemplateToClass, useClassGradeAssignments, useGradeTemplates } from '@/hooks/useAssessmentSettings';
import { useClasses } from '@/hooks/useCoreLookups';
import { useTranslations } from 'next-intl';

export function GradeTemplateAssignment() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const assignMutation = useAssignGradeTemplateToClass();

  const templatesQuery = useGradeTemplates();
  const classesQuery = useClasses();
  const assignmentsQuery = useClassGradeAssignments();

  const [gradeTemplateId, setGradeTemplateId] = useState<string | null>(null);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [minimumPassingGrade, setMinimumPassingGrade] = useState<string | null>(null);

  const templateOptions = useMemo(
    () => (templatesQuery.data?.data ?? []).map((t) => ({ value: t.id, label: t.name })),
    [templatesQuery.data?.data],
  );
  const classOptions = useMemo(
    () => (classesQuery.data?.data ?? []).map((c) => ({ value: c.id, label: c.displayName })),
    [classesQuery.data?.data],
  );

  const selectedTemplate = (templatesQuery.data?.data ?? []).find((t) => t.id === gradeTemplateId);
  const gradeOptions = (selectedTemplate?.ranges ?? []).map((r) => ({ value: r.letter, label: r.letter }));

  const canSubmit = Boolean(gradeTemplateId && classIds.length > 0 && minimumPassingGrade);

  const onAssign = async () => {
    if (!gradeTemplateId || classIds.length === 0 || !minimumPassingGrade) return;
    try {
      await assignMutation.mutateAsync({ gradeTemplateId, classIds, minimumPassingGrade });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('gradeAssignSuccess'),
        color: notifyColors.success,
      });
      setClassIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  if (templatesQuery.error || classesQuery.error || assignmentsQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('gradeAssignLoadError')}>
        <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={600}>{tSettings('gradeAssignTitle')}</Text>
          <Select
            id="grade-template-assign-template"
            label={tSettings('gradeAssignTemplateLabel')}
            placeholder={tSettings('gradeAssignTemplatePlaceholder')}
            data={templateOptions}
            value={gradeTemplateId}
            onChange={(v) => { setGradeTemplateId(v); setMinimumPassingGrade(null); }}
          />
          <MultiSelect
            id="grade-template-assign-class"
            label={tSettings('gradeAssignClassLabel')}
            placeholder={tSettings('gradeAssignClassPlaceholder')}
            data={classOptions}
            value={classIds}
            onChange={setClassIds}
            searchable
            clearable
          />
          <Select
            id="grade-template-assign-passing-grade"
            label={tSettings('gradeAssignPassingGradeLabel')}
            placeholder={tSettings('gradeAssignPassingGradePlaceholder')}
            data={gradeOptions}
            disabled={!gradeTemplateId}
            value={minimumPassingGrade}
            onChange={setMinimumPassingGrade}
          />
          <Group justify="flex-end">
            <Button id="grade-template-assign-submit" variant="light" onClick={onAssign} disabled={!canSubmit} loading={assignMutation.isPending}>
              {tCommon('save')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={600}>{tSettings('gradeAssignExistingTitle')}</Text>
          {(assignmentsQuery.data?.data ?? []).length === 0 ? (
            <Text size="sm" c="dimmed">{tSettings('gradeAssignNoData')}</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{tSettings('gradeAssignColClass')}</Table.Th>
                  <Table.Th>{tSettings('gradeAssignColTemplate')}</Table.Th>
                  <Table.Th>{tSettings('gradeAssignColPassingGrade')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(assignmentsQuery.data?.data ?? []).map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{row.className}</Table.Td>
                    <Table.Td>{row.gradeTemplateName}</Table.Td>
                    <Table.Td>{row.minimumPassingGrade}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
