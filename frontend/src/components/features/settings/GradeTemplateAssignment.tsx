'use client';

import { Alert, Button, Group, Paper, Select, Stack, Table, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useAssignGradeTemplateToClass, useClassGradeAssignments, useGradeTemplates } from '@/hooks/useAssessmentSettings';
import { useClasses } from '@/hooks/useCoreLookups';

export function GradeTemplateAssignment() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const assignMutation = useAssignGradeTemplateToClass();

  const templatesQuery = useGradeTemplates();
  const classesQuery = useClasses();
  const assignmentsQuery = useClassGradeAssignments();

  const [gradeTemplateId, setGradeTemplateId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
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

  const canSubmit = Boolean(gradeTemplateId && classId && minimumPassingGrade);

  const onAssign = async () => {
    if (!gradeTemplateId || !classId || !minimumPassingGrade) return;
    try {
      await assignMutation.mutateAsync({ gradeTemplateId, classId, minimumPassingGrade });
      notifications.show({ title: 'Success', message: 'Grade template assigned', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (templatesQuery.error || classesQuery.error || assignmentsQuery.error) {
    return (
      <Alert color={colors.error} title="Failed to load data">
        <Text size="sm">Please try again.</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={600}>Assign template to class</Text>

          <Select
            label="Grade template"
            placeholder="Select template"
            data={templateOptions}
            value={gradeTemplateId}
            onChange={(v) => {
              setGradeTemplateId(v);
              setMinimumPassingGrade(null);
            }}
          />

          <Select
            label="Class"
            placeholder="Select class"
            data={classOptions}
            value={classId}
            onChange={setClassId}
          />

          <Select
            label="Minimum passing grade"
            placeholder="Select grade"
            data={gradeOptions}
            disabled={!gradeTemplateId}
            value={minimumPassingGrade}
            onChange={setMinimumPassingGrade}
          />

          <Group justify="flex-end">
            <Button variant="light" onClick={onAssign} disabled={!canSubmit} loading={assignMutation.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={600}>Existing assignments</Text>
          {(assignmentsQuery.data?.data ?? []).length === 0 ? (
            <Text size="sm" c="dimmed">
              No assignments yet.
            </Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Class</Table.Th>
                  <Table.Th>Grade template</Table.Th>
                  <Table.Th>Minimum passing grade</Table.Th>
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


