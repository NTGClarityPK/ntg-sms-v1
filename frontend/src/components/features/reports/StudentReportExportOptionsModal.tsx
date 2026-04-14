'use client';

import { useMemo, useState } from 'react';
import { Button, Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';

export type StudentReportExportSection =
  | 'academic'
  | 'attendance'
  | 'behavioral'
  | 'assignmentStatistics'
  | 'assignmentEngagement';

const ALL_STUDENT_SECTIONS: StudentReportExportSection[] = [
  'academic',
  'attendance',
  'behavioral',
  'assignmentStatistics',
  'assignmentEngagement',
];

export interface StudentReportExportOptionsModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: (sections: StudentReportExportSection[]) => Promise<void> | void;
  confirmLoading?: boolean;
}

export function StudentReportExportOptionsModal({
  opened,
  onClose,
  onConfirm,
  confirmLoading,
}: StudentReportExportOptionsModalProps) {
  const t = useTranslations('reports');
  const [selected, setSelected] = useState<StudentReportExportSection[]>(ALL_STUDENT_SECTIONS);

  const allChecked = selected.length === ALL_STUDENT_SECTIONS.length;
  const noneChecked = selected.length === 0;

  const labels = useMemo(
    () =>
      new Map<StudentReportExportSection, string>([
        ['academic', t('exportSectionAcademic')],
        ['attendance', t('exportSectionAttendance')],
        ['behavioral', t('exportSectionBehavioural')],
        ['assignmentStatistics', t('exportSectionAssignmentStatistics')],
        ['assignmentEngagement', t('exportSectionAssignmentEngagement')],
      ]),
    [t],
  );

  const handleConfirm = async () => {
    await onConfirm(selected);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('exportOptionsTitle')}
      centered
      size="md"
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {t('exportOptionsHelp')}
        </Text>

        <Stack gap={6}>
          {ALL_STUDENT_SECTIONS.map((key) => (
            <Checkbox
              key={key}
              label={labels.get(key) ?? key}
              checked={selected.includes(key)}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                setSelected((prev) =>
                  checked ? [...prev, key] : prev.filter((x) => x !== key),
                );
              }}
            />
          ))}
        </Stack>

        <Group justify="space-between" mt="sm">
          <Group gap="xs">
            <Button
              variant="subtle"
              onClick={() => setSelected(ALL_STUDENT_SECTIONS)}
              disabled={allChecked || !!confirmLoading}
            >
              {t('exportSelectAll')}
            </Button>
            <Button
              variant="subtle"
              onClick={() => setSelected([])}
              disabled={noneChecked || !!confirmLoading}
            >
              {t('exportSelectNone')}
            </Button>
          </Group>

          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={!!confirmLoading}>
              {t('exportCancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              loading={!!confirmLoading}
              disabled={noneChecked}
            >
              {t('exportConfirm')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

