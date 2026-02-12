'use client';

/**
 * Edit Assessment Page
 */

import { useEffect } from 'react';
import { Title, Paper, Stack, Skeleton, Text, Group, Button } from '@mantine/core';
import { useRouter, useParams } from 'next/navigation';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { useAssessment, useUpdateAssessment } from '@/hooks/api/useAssessments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import type { UpdateAssessmentInput } from '@/types/assessment';

export default function EditAssessmentPage() {
  const router = useRouter();
  const params = useParams();
  const { canEdit } = useFeaturePermission('assessment');
  const assessmentId = params.id as string;
  const { data: assessmentData, isLoading } = useAssessment(assessmentId);
  const assessment = assessmentData; // Hook already returns response.data, so assessmentData is the Assessment directly
  const updateAssessment = useUpdateAssessment(assessmentId);

  useEffect(() => {
    if (!canEdit) router.replace('/assessments');
  }, [canEdit, router]);

  const handleSubmit = (values: UpdateAssessmentInput) => {
    updateAssessment.mutate(values, {
      onSuccess: () => {
        router.push('/assessments');
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Skeleton height={40} width="30%" />
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
          <Title order={1}>Edit Assessment</Title>
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
          <Title order={1}>Edit Assessment</Title>
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
            <AssessmentForm
              assessment={assessment}
              onSubmit={handleSubmit}
              isLoading={updateAssessment.isPending}
            />
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => router.back()}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </div>
    </>
  );
}

