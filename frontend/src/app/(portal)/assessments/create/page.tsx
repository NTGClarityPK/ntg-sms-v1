'use client';

/**
 * Create Assessment Page
 */

import { Title, Paper, Button, Group, Stack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { useCreateAssessment } from '@/hooks/api/useAssessments';
import type { CreateAssessmentInput, UpdateAssessmentInput } from '@/types/assessment';

export default function CreateAssessmentPage() {
  const router = useRouter();
  const createAssessment = useCreateAssessment();

  const handleSubmit = (values: CreateAssessmentInput | UpdateAssessmentInput) => {
    createAssessment.mutate(values as CreateAssessmentInput, {
      onSuccess: () => {
        router.push('/assessments');
      },
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Create Assessment</Title>
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
            <AssessmentForm onSubmit={handleSubmit} isLoading={createAssessment.isPending} />
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

