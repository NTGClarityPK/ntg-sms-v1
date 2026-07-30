'use client';

/**
 * Grade Entry Sheet Component
 * Bulk grade entry interface for all students in an assessment
 */

import { useEffect, useMemo, useState, type ReactNode, Fragment } from 'react';
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
  ScrollArea,
  Alert,
  Badge,
  Divider,
  Collapse,
  Box,
} from '@mantine/core';
import { IconAlertCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useAssessmentGrades, useBulkCreateGrades } from '@/hooks/api/useGrades';
import { useAssessmentRubric } from '@/hooks/api/useRubrics';
import { useClassSection, useClassSectionStudents } from '@/hooks/useClassSections';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { PerCategoryScoreEntry } from '@/components/features/rubrics/PerCategoryScoreEntry';
import type { Assessment, CreateStudentGradeInput } from '@/types/assessment';

interface GradeEntrySheetProps {
  assessment: Assessment;
  readOnly?: boolean;
}

interface GradeRow extends CreateStudentGradeInput {
  studentName: string;
  studentGradeId?: string;
}

type SortColumn = 'studentName' | 'marksObtained' | 'isAbsent' | 'isExcused';

export function GradeEntrySheet({ assessment, readOnly = false }: GradeEntrySheetProps) {
  const t = useTranslations('assessment');
  const tRubrics = useTranslations('rubrics');
  const colors = useThemeColors();
  const { data: existingGrades, isLoading: gradesLoading } = useAssessmentGrades(assessment.id);
  const { data: rubricWithScores, isLoading: rubricLoading } = useAssessmentRubric(assessment.id);
  const { data: classSection, isLoading: classSectionLoading } = useClassSection(assessment.classSectionId);
  const { data: classSectionStudentsData, isLoading: studentsLoading } = useClassSectionStudents(
    assessment.classSectionId,
  );
  const bulkCreateGrades = useBulkCreateGrades();
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [sortBy, setSortBy] = useState<SortColumn>('studentName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const rubric = rubricWithScores?.rubric ?? null;
  const hasRubric = !!rubric?.categories?.length;
  const allScores = rubricWithScores?.scores ?? [];

  // Load students and pre-fill with existing grades
  useEffect(() => {
    if (!classSectionStudentsData?.data || studentsLoading || classSectionLoading) {
      return;
    }

    const students = classSectionStudentsData?.data || [];
    const gradesList = existingGrades || [];
    const gradesMap = new Map(gradesList.map((g) => [g.studentId, g]));

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
        studentGradeId: existing?.id,
      };
    });

    setGrades(gradeRows);
  }, [assessment.id, existingGrades, classSectionStudentsData, studentsLoading, classSectionLoading]);

  const updateGrade = (studentId: string, field: keyof GradeRow, value: string | number | boolean) => {
    setGrades((prev) =>
      prev.map((g) => (g.studentId === studentId ? { ...g, [field]: value } : g)),
    );
  };

  const setAbsent = (studentId: string, checked: boolean) => {
    setGrades((prev) =>
      prev.map((g) =>
        g.studentId === studentId
          ? { ...g, isAbsent: checked, marksObtained: checked ? 0 : g.marksObtained }
          : g,
      ),
    );
  };

  const setExcused = (studentId: string, checked: boolean) => {
    setGrades((prev) =>
      prev.map((g) =>
        g.studentId === studentId
          ? { ...g, isExcused: checked, marksObtained: checked ? 0 : g.marksObtained }
          : g,
      ),
    );
  };

  const handleSubmit = () => {
    bulkCreateGrades.mutate({
      assessmentId: assessment.id,
      grades: grades.map(({ studentName: _name, studentGradeId: _gid, ...grade }) => grade),
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const sortedGrades = useMemo(() => {
    const mult = sortOrder === 'asc' ? 1 : -1;
    const arr = [...grades];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'studentName':
          cmp = a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' });
          break;
        case 'marksObtained':
          cmp = (a.marksObtained ?? 0) - (b.marksObtained ?? 0);
          break;
        case 'isAbsent':
          cmp = Number(a.isAbsent) - Number(b.isAbsent);
          break;
        case 'isExcused':
          cmp = Number(a.isExcused) - Number(b.isExcused);
          break;
        default:
          cmp = 0;
      }
      return cmp * mult;
    });
    return arr;
  }, [grades, sortBy, sortOrder]);

  const skipNonMarksTab = !readOnly;

  const SortableHeader = ({ column, children }: { column: SortColumn; children: ReactNode }) => {
    const isSorted = sortBy === column;
    const isAsc = isSorted && sortOrder === 'asc';

    return (
      <Table.Th
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSort(column)}
        aria-sort={
          isSorted ? (isAsc ? 'ascending' : 'descending') : 'none'
        }
      >
        <Group gap="xs" wrap="nowrap">
          <Text fw={500}>{children}</Text>
          {isSorted && (isAsc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />)}
        </Group>
      </Table.Th>
    );
  };

  const isLoading = gradesLoading || classSectionLoading || studentsLoading || rubricLoading;

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

  const saveTabIndex = !readOnly && sortedGrades.length > 0 ? sortedGrades.length + 1 : undefined;
  // Assessment total_marks is authoritative; rubric categories have their own sub-totals.
  const totalMarksDisplay = assessment.totalMarks;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" align="flex-start">
        <Text fw={500}>{t('studentGrades')}</Text>
        <Group gap="md" wrap="wrap" justify="flex-end">
          <Badge variant="light" color={colors.info} size="lg">
            {t('totalMarksLabel')}: {totalMarksDisplay}
          </Badge>
          {!readOnly && !hasRubric && (
            <Button
              id="grade-entry-save-all"
              onClick={handleSubmit}
              loading={bulkCreateGrades.isPending}
              tabIndex={saveTabIndex}
            >
              {t('saveAllGrades')}
            </Button>
          )}
          {!readOnly && hasRubric && (
            <Button
              id="grade-entry-save-all"
              onClick={handleSubmit}
              loading={bulkCreateGrades.isPending}
              variant="light"
              tabIndex={saveTabIndex}
            >
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

      <Group gap="xs" wrap="wrap">
        <Badge variant="light" color="blue">
          {t('subject')}: {assessment.subjectName ?? '—'}
        </Badge>
        <Badge variant="light" color="teal">
          {t('postedBy')}: {assessment.teacherName ?? '—'}
        </Badge>
        {hasRubric && (
          <Badge variant="light" color="violet">
            {tRubrics('breakdown')}
          </Badge>
        )}
      </Group>

      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {hasRubric && <Table.Th />}
              <SortableHeader column="studentName">{t('studentName')}</SortableHeader>
              <SortableHeader column="marksObtained">{t('marksObtained')}</SortableHeader>
              <SortableHeader column="isAbsent">{t('absent')}</SortableHeader>
              <SortableHeader column="isExcused">{t('excused')}</SortableHeader>
              <Table.Th>
                <Text fw={500}>{t('remarks')}</Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedGrades.map((grade, sortedIndex) => {
              const marksTabIndex = !readOnly ? sortedIndex + 1 : undefined;
              const isExpanded = expandedStudentId === grade.studentId;
              const studentScores = grade.studentGradeId
                ? allScores.filter((s) => s.studentGradeId === grade.studentGradeId)
                : [];

              return (
                <Fragment key={grade.studentId}>
                  <Table.Tr>
                    {hasRubric && (
                      <Table.Td>
                        <Button
                          id={`grade-entry-expand-${grade.studentId}`}
                          variant="subtle"
                          size="compact-xs"
                          disabled={!grade.studentGradeId}
                          onClick={() =>
                            setExpandedStudentId((prev) =>
                              prev === grade.studentId ? null : grade.studentId,
                            )
                          }
                        >
                          {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                        </Button>
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Text>{grade.studentName}</Text>
                    </Table.Td>
                    <Table.Td>
                      {hasRubric ? (
                        <Text size="sm" fw={500}>
                          {grade.marksObtained ?? 0}
                        </Text>
                      ) : (
                        <NumberInput
                          id={`grade-entry-marks-${grade.studentId}`}
                          value={grade.marksObtained}
                          onChange={(value) => {
                            const n = typeof value === 'number' ? value : Number(value);
                            updateGrade(
                              grade.studentId,
                              'marksObtained',
                              Number.isFinite(n) ? n : 0,
                            );
                          }}
                          min={0}
                          max={assessment.totalMarks}
                          disabled={readOnly || grade.isAbsent || grade.isExcused}
                          size="sm"
                          w={100}
                          tabIndex={marksTabIndex}
                        />
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={grade.isAbsent}
                        onChange={(e) => setAbsent(grade.studentId, e.currentTarget.checked)}
                        size="sm"
                        disabled={readOnly}
                        tabIndex={skipNonMarksTab ? -1 : undefined}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={grade.isExcused}
                        onChange={(e) => setExcused(grade.studentId, e.currentTarget.checked)}
                        size="sm"
                        disabled={readOnly}
                        tabIndex={skipNonMarksTab ? -1 : undefined}
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        id={`grade-entry-remarks-${grade.studentId}`}
                        value={grade.remarks}
                        onChange={(e) => updateGrade(grade.studentId, 'remarks', e.currentTarget.value)}
                        placeholder={t('optionalRemarks')}
                        size="sm"
                        disabled={readOnly}
                        tabIndex={skipNonMarksTab ? -1 : undefined}
                      />
                    </Table.Td>
                  </Table.Tr>
                  {hasRubric && (
                    <Table.Tr>
                      <Table.Td colSpan={6} p={0}>
                        <Collapse in={isExpanded}>
                          <Box p="md">
                            {grade.studentGradeId && rubric ? (
                              <PerCategoryScoreEntry
                                studentGradeId={grade.studentGradeId}
                                categories={rubric.categories}
                                existingScores={studentScores}
                                readOnly={readOnly || grade.isAbsent || grade.isExcused}
                                onSaved={(total) =>
                                  updateGrade(grade.studentId, 'marksObtained', total)
                                }
                              />
                            ) : (
                              <Text size="sm" c="dimmed">
                                {t('saveAllGrades')}
                              </Text>
                            )}
                          </Box>
                        </Collapse>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Fragment>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}
