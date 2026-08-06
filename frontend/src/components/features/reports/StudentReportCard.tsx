'use client';

import { Stack, Title, Text, Skeleton } from '@mantine/core';
import { AcademicSection } from './AcademicSection';
import { AttendanceSection } from './AttendanceSection';
import { BehavioralSectionReport } from './BehavioralSection';
import { AssignmentEngagementSection } from './AssignmentEngagementSection';
import { CombinedBehavioralHistory } from '@/components/features/behavioral/CombinedBehavioralHistory';
import { useTranslations } from 'next-intl';
import type { StudentReport as StudentReportType } from '@/types/reports';

interface StudentReportCardProps {
  report: StudentReportType | null | undefined;
  isLoading: boolean;
}

export function StudentReportCard({ report, isLoading }: StudentReportCardProps) {
  const t = useTranslations('reports');
  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width={200} radius="sm" />
        <Skeleton height={200} radius="sm" />
      </Stack>
    );
  }

  if (!report) {
    return <Text c="dimmed">{t('studentNoReportData')}</Text>;
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{report.studentName}</Title>
        <Text size="sm" c="dimmed">
          {report.academicYearName}
        </Text>
      </div>

      {report.academic && <AcademicSection data={report.academic} isLoading={false} />}
      {report.attendance && <AttendanceSection data={report.attendance} isLoading={false} />}
      {report.behavioral && (
        <BehavioralSectionReport
          data={report.behavioral}
          isLoading={false}
          assignmentStatistics={report.assignmentStatistics}
        />
      )}
      <CombinedBehavioralHistory
        studentId={report.studentId}
        academicYearId={report.academicYearId}
      />
      {report.assignmentEngagement && report.assignmentEngagement.length > 0 && (
        <AssignmentEngagementSection data={report.assignmentEngagement} />
      )}
    </Stack>
  );
}
