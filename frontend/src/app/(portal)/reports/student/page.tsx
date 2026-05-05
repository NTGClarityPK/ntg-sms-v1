'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Group, Title, Select, Stack, Skeleton, Alert, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useStudents, useMyStudent } from '@/hooks/useStudents';
import { StudentReportCard } from '@/components/features/reports/StudentReportCard';
import { ReportPeriodSelector } from '@/components/features/reports/ReportPeriodSelector';
import { ExportButton } from '@/components/features/reports/ExportButton';
import { useStudentReport } from '@/hooks/useReports';
import { useAuth } from '@/hooks/useAuth';
import type { Student } from '@/types/students';
import { ReportPeriodType } from '@/types/reports';

function periodFromQuery(param: string | null): ReportPeriodType | null {
  if (param === 'week') return ReportPeriodType.WEEK;
  if (param === 'month') return ReportPeriodType.MONTH;
  if (param === 'year') return ReportPeriodType.YEAR;
  return null;
}

export default function StudentReportSelectPage() {
  const searchParams = useSearchParams();
  const periodParam = searchParams?.get('period') ?? null;
  const t = useTranslations('reports');
  const { user } = useAuth();
  const isStudent = user?.roles?.some((r) => r.roleName.toLowerCase() === 'student');
  const myStudentQuery = useMyStudent();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<ReportPeriodType | null>(
    () => periodFromQuery(periodParam) ?? ReportPeriodType.YEAR
  );
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const studentsQuery = useStudents({ limit: 100 });
  const reportQuery = useStudentReport(studentId, undefined, periodType, startDate, endDate);

  // Auto-select student's own ID if they are a student
  useEffect(() => {
    if (isStudent && myStudentQuery.data?.data?.id && !studentId) {
      setStudentId(myStudentQuery.data.data.id);
    }
  }, [isStudent, myStudentQuery.data, studentId]);

  const students = (studentsQuery.data?.data as Student[] | undefined) ?? [];
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Unknown'} (${s.studentId})`,
  }));

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('studentTab')}</Title>
          {studentId && (
            <ExportButton variant="student" studentId={studentId} />
          )}
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
          <ReportPeriodSelector
            value={periodType}
            startDate={startDate}
            endDate={endDate}
            onChange={(type, start, end) => {
              setPeriodType(type);
              setStartDate(start);
              setEndDate(end);
            }}
          />

          {isStudent ? (
            <Alert color="blue">
              <Text fw={600}>{t('studentSelfTitle')}</Text>
              <Text size="sm">{t('studentSelfDescription')}</Text>
            </Alert>
          ) : (
            <Select
              id="reports-student-select"
              label={t('studentSelectLabel')}
              placeholder={t('studentSelectPlaceholder')}
              data={studentOptions}
              value={studentId}
              onChange={setStudentId}
              clearable
              searchable
              style={{ maxWidth: 400 }}
            />
          )}

          {!studentId ? (
            <Alert color="blue">{t('studentSelectHint')}</Alert>
          ) : (
            <StudentReportCard
              report={reportQuery.data ?? null}
              isLoading={reportQuery.isLoading}
            />
          )}
        </Stack>
      </div>
    </>
  );
}
