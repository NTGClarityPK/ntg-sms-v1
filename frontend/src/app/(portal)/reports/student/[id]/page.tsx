'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Group, Title, Stack } from '@mantine/core';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { StudentReportCard } from '@/components/features/reports/StudentReportCard';
import { ExportButton } from '@/components/features/reports/ExportButton';
import { ReportPeriodSelector } from '@/components/features/reports/ReportPeriodSelector';
import { useStudentReport } from '@/hooks/useReports';
import { useMyStudent } from '@/hooks/useStudents';
import { useAuth } from '@/hooks/useAuth';
import { ReportPeriodType } from '@/types/reports';

export default function StudentReportByIdPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isStudent = user?.roles?.some((r) => r.roleName.toLowerCase() === 'student');
  const myStudentQuery = useMyStudent();
  const id =
    params && typeof (params as Record<string, unknown>).id === 'string'
      ? ((params as Record<string, unknown>).id as string)
      : null;
  const [periodType, setPeriodType] = useState<ReportPeriodType | null>(ReportPeriodType.YEAR);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  // Redirect student if trying to access another student's report
  useEffect(() => {
    if (isStudent && myStudentQuery.data?.data?.id && id && id !== myStudentQuery.data.data.id) {
      router.replace(`/reports/student/${myStudentQuery.data.data.id}`);
    }
  }, [isStudent, myStudentQuery.data, id, router]);

  const reportQuery = useStudentReport(id, undefined, periodType, startDate, endDate);

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Student report</Title>
          <Group>
            {id && (
              <ExportButton variant="student" studentId={id} />
            )}
            <Button
              id="reports-student-back"
              component={Link}
              href="/reports/student"
              leftSection={<IconArrowLeft size={16} />}
              variant="subtle"
            >
              Back
            </Button>
          </Group>
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

          {id ? (
            <StudentReportCard
              report={reportQuery.data ?? null}
              isLoading={reportQuery.isLoading}
            />
          ) : (
            <StudentReportCard report={null} isLoading={false} />
          )}
        </Stack>
      </div>
    </>
  );
}
