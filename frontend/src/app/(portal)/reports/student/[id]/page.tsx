'use client';

import { useParams } from 'next/navigation';
import { Group, Title, Stack } from '@mantine/core';
import Link from 'next/link';
import { Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { StudentReportCard } from '@/components/features/reports/StudentReportCard';
import { ExportButton } from '@/components/features/reports/ExportButton';
import { useStudentReport } from '@/hooks/useReports';

export default function StudentReportByIdPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;

  const reportQuery = useStudentReport(id);

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
