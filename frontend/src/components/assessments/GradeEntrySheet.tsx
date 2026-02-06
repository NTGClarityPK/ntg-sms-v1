'use client';

/**
 * Grade Entry Sheet Component
 * Bulk grade entry interface for all students in an assessment
 */

import { useEffect, useState } from 'react';
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
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAssessmentGrades, useBulkCreateGrades } from '@/hooks/api/useGrades';
import { useClassSection } from '@/hooks/useClassSections';
import { useStudents } from '@/hooks/useStudents';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { Assessment, CreateStudentGradeInput } from '@/types/assessment';

interface GradeEntrySheetProps {
  assessment: Assessment;
}

interface GradeRow extends CreateStudentGradeInput {
  studentName: string;
}

export function GradeEntrySheet({ assessment }: GradeEntrySheetProps) {
  const colors = useThemeColors();
  const { data: existingGrades, isLoading: gradesLoading } = useAssessmentGrades(assessment.id);
  const { data: classSection, isLoading: classSectionLoading } = useClassSection(assessment.classSectionId);
  const { data: studentsData, isLoading: studentsLoading } = useStudents({
    classId: classSection?.classId,
    sectionId: classSection?.sectionId,
    isActive: true,
    limit: 100, // Backend max limit is 100
  });
  const bulkCreateGrades = useBulkCreateGrades();
  const [grades, setGrades] = useState<GradeRow[]>([]);

  // Load students and pre-fill with existing grades
  useEffect(() => {
    if (!studentsData?.data || studentsLoading || classSectionLoading) {
      return;
    }

    const students = studentsData.data;
    const gradesMap = new Map(existingGrades?.map((g) => [g.studentId, g]) || []);

    const gradeRows: GradeRow[] = students.map((student) => {
      const existing = gradesMap.get(student.id);
      return {
        studentId: student.id,
        studentName: student.fullName || `${student.studentId}`,
        assessmentId: assessment.id,
        marksObtained: existing?.marksObtained ?? 0,
        isAbsent: existing?.isAbsent ?? false,
        isExcused: existing?.isExcused ?? false,
        remarks: existing?.remarks ?? '',
      };
    });

    setGrades(gradeRows);
  }, [assessment.id, existingGrades, studentsData, studentsLoading, classSectionLoading]);

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
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Class section not found for this assessment.
      </Alert>
    );
  }

  if (!studentsData?.data || studentsData.data.length === 0) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="No Students" color="yellow">
        No active students found in this class section. Please add students before entering grades.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={500}>Student Grades</Text>
        <Group gap="md">
          <Badge variant="light" color={colors.info} size="lg">
            Total Marks: {assessment.totalMarks}
          </Badge>
          <Button onClick={handleSubmit} loading={bulkCreateGrades.isPending}>
            Save All Grades
          </Button>
        </Group>
      </Group>

      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Student Name</Table.Th>
              <Table.Th>Marks Obtained</Table.Th>
              <Table.Th>Absent</Table.Th>
              <Table.Th>Excused</Table.Th>
              <Table.Th>Remarks</Table.Th>
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
                    disabled={grade.isAbsent || grade.isExcused}
                    size="sm"
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={grade.isAbsent}
                    onChange={(e) => updateGrade(index, 'isAbsent', e.currentTarget.checked)}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <Switch
                    checked={grade.isExcused}
                    onChange={(e) => updateGrade(index, 'isExcused', e.currentTarget.checked)}
                    size="sm"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={grade.remarks}
                    onChange={(e) => updateGrade(index, 'remarks', e.currentTarget.value)}
                    placeholder="Optional remarks"
                    size="sm"
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

