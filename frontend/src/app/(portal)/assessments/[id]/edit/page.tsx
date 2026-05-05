'use client';

/**
 * Edit Assessment Page
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Title, Paper, Stack, Skeleton, Text, Group, Button } from '@mantine/core';
import { useRouter, useParams } from 'next/navigation';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { useAssessment, useUpdateAssessment } from '@/hooks/api/useAssessments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import type { UpdateAssessmentInput } from '@/types/assessment';

export default function EditAssessmentPage() {
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useParams();
  const { canEdit } = useFeaturePermission('assessment');
  const assessmentId =
    (params && typeof (params as Record<string, unknown>).id === 'string'
      ? ((params as Record<string, unknown>).id as string)
      : undefined) ?? '';
  const { data: assessmentData, isLoading } = useAssessment(assessmentId || undefined);
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
          <Title order={1}>{t('editAssessment')}</Title>
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
              {t('assessmentNotFound')}
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
          <Title order={1}>{t('editAssessment')}</Title>
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
              {tCommon('cancel')}
            </Button>
          </Group>
        </Stack>
      </div>
    </>
  );
}

