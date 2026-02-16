'use client';

/**
 * Assessment Grade Entry Page
 * Allows bulk grade entry for all students in an assessment
 */

import { Title, Paper, Stack, Text, Skeleton, Group, Button } from '@mantine/core';
import { useRouter, useParams } from 'next/navigation';
import { useAssessment } from '@/hooks/api/useAssessments';
import { GradeEntrySheet } from '@/components/assessments/GradeEntrySheet';
import { useFeaturePermission } from '@/hooks/usePermissions';

export default function AssessmentGradesPage() {
  const router = useRouter();
  const params = useParams();
  const { canEdit } = useFeaturePermission('assessment');
  const assessmentId = params.id as string;
  const { data: assessmentData, isLoading } = useAssessment(assessmentId);
  const assessment = assessmentData; // Hook already returns response.data, so assessmentData is the Assessment directly

  if (isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Skeleton height={40} width="40%" />
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
          <Skeleton height={400} />
        </div>
      </>
    );
  }

  if (!assessment) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Grade</Title>
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
          <Paper p="xl" withBorder>
            <Text ta="center" c="dimmed">
              Assessment not found.
            </Text>
          </Paper>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{canEdit ? `Grade Entry: ${assessment.title}` : `Grade: ${assessment.title}`}</Title>
          <Button variant="subtle" onClick={() => router.back()}>
            Back
          </Button>
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
          <Paper p="md" withBorder>
            <GradeEntrySheet assessment={assessment} readOnly={!canEdit} />
          </Paper>
        </Stack>
      </div>
    </>
  );
}

