'use client';

import { useState } from 'react';
import { Group, Title, Select, Stack, Skeleton, Alert } from '@mantine/core';
import { useStudents } from '@/hooks/useStudents';
import { StudentReportCard } from '@/components/features/reports/StudentReportCard';
import { useStudentReport } from '@/hooks/useReports';
import type { Student } from '@/types/students';

export default function StudentReportSelectPage() {
  const [studentId, setStudentId] = useState<string | null>(null);

  const studentsQuery = useStudents({ limit: 100 });
  const reportQuery = useStudentReport(studentId);

  const students = (studentsQuery.data?.data as Student[] | undefined) ?? [];
  const studentOptions = students.map((s) => ({
    value: s.id,
    label: `${s.fullName ?? 'Unknown'} (${s.studentId})`,
  }));

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Student report</Title>
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
          <Select
            label="Select student"
            placeholder="Choose a student"
            data={studentOptions}
            value={studentId}
            onChange={setStudentId}
            clearable
            searchable
            style={{ maxWidth: 400 }}
          />

          {!studentId ? (
            <Alert color="blue">Select a student to view their report.</Alert>
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
