'use client';

/**
 * Grade Entry Sheet Component
 * Bulk grade entry interface for all students in an assessment
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Stack,
  Table,
  TextInput,
  NumberInput,
  Switch,
  Button,
  Group,
  Text,
  Skeleton,
  Box,
  ScrollArea,
  Alert,
  Badge,
  Divider,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAssessmentGrades, useBulkCreateGrades } from '@/hooks/api/useGrades';
import { useClassSection, useClassSectionStudents } from '@/hooks/useClassSections';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { Assessment, CreateStudentGradeInput } from '@/types/assessment';

interface GradeEntrySheetProps {
  assessment: Assessment;
  readOnly?: boolean;
}

interface GradeRow extends CreateStudentGradeInput {
  studentName: string;
}

export function GradeEntrySheet({ assessment, readOnly = false }: GradeEntrySheetProps) {
  const t = useTranslations('assessment');
  const colors = useThemeColors();
  const { data: existingGrades, isLoading: gradesLoading } = useAssessmentGrades(assessment.id);
  const { data: classSection, isLoading: classSectionLoading } = useClassSection(assessment.classSectionId);
  const { data: classSectionStudentsData, isLoading: studentsLoading } = useClassSectionStudents(
    assessment.classSectionId,
  );
  const bulkCreateGrades = useBulkCreateGrades();
  const [grades, setGrades] = useState<GradeRow[]>([]);

  // Load students and pre-fill with existing grades
  useEffect(() => {
    if (!classSectionStudentsData?.data || studentsLoading || classSectionLoading) {
      return;
    }

    const students = classSectionStudentsData?.data || [];
    const grades = existingGrades || []; // useAssessmentGrades returns response.data (already unwrapped)
    const gradesMap = new Map(grades.map((g) => [g.studentId, g]));

    const gradeRows: GradeRow[] = students.map((student) => {
      const existing = gradesMap.get(student.id);
      return {
        studentId: student.id,
        studentName: `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || `${student.studentId}`,
        assessmentId: assessment.id,
        marksObtained: existing?.marksObtained ?? 0,
        isAbsent: existing?.isAbsent ?? false,
        isExcused: existing?.isExcused ?? false,
        remarks: existing?.remarks ?? '',
      };
    });

    setGrades(gradeRows);
  }, [assessment.id, existingGrades, classSectionStudentsData, studentsLoading, classSectionLoading]);

  const updateGrade = (index: number, field: keyof GradeRow, value: any) => {
    setGrades((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = () => {
    bulkCreateGrades.mutate({
      assessmentId: assessment.id,
      grades: grades.map(({ studentName, ...grade }) => grade),
    });
  };

  const isLoading = gradesLoading || classSectionLoading || studentsLoading;

  if (isLoading) {
    return (
      <Stack gap="md">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height={60} />
        ))}
      </Stack>
    );
  }

  if (!classSection) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title={t('error')} color="red">
        {t('classSectionNotFound')}
      </Alert>
    );
  }

  if (!classSectionStudentsData?.data || classSectionStudentsData.data.length === 0) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title={t('noStudents')} color="yellow">
        {t('noActiveStudentsInSection')}
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={500}>{t('studentGrades')}</Text>
        <Group gap="md">
          <Badge variant="light" color={colors.info} size="lg">
            {t('totalMarksLabel')}: {assessment.totalMarks}
          </Badge>
          {!readOnly && (
            <Button onClick={handleSubmit} loading={bulkCreateGrades.isPending}>
              {t('saveAllGrades')}
            </Button>
          )}
        </Group>
      </Group>

      {readOnly && (
        <>
          <Alert icon={<IconAlertCircle size={16} />} color={colors.info} title={t('viewOnly')}>
            {t('viewOnlyGradeMessage')}
          </Alert>
          <Divider />
        </>
      )}

      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('studentName')}</Table.Th>
              <Table.Th>{t('marksObtained')}</Table.Th>
              <Table.Th>{t('absent')}</Table.Th>
              <Table.Th>{t('excused')}</Table.Th>
              <Table.Th>{t('remarks')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {grades.map((grade, index) => (
              <Table.Tr key={grade.studentId}>
                <Table.Td>
                  <Text>{grade.studentName}</Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={grade.marksObtained}
                    onChange={(value) => updateGrade(index, 'marksObtained', value ?? 0)}
                    min={0}
                    max={assessment.totalMarks}
                    disabled={readOnly || grade.isAbsent || grade.isExcused}
                    size="sm"
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={grade.isAbsent}
                    onChange={(e) => updateGrade(index, 'isAbsent', e.currentTarget.checked)}
                    size="sm"
                    disabled={readOnly}
                  />
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={grade.isExcused}
                    onChange={(e) => updateGrade(index, 'isExcused', e.currentTarget.checked)}
                    size="sm"
                    disabled={readOnly}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={grade.remarks}
                    onChange={(e) => updateGrade(index, 'remarks', e.currentTarget.value)}
                    placeholder={t('optionalRemarks')}
                    size="sm"
                    disabled={readOnly}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}

