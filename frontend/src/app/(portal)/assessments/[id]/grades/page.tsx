'use client';

/**
 * Assessment Grade Entry Page
 * Allows bulk grade entry for all students in an assessment
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Title, Paper, Stack, Text, Skeleton, Group, Button, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useRouter, useParams } from 'next/navigation';
import { useAssessment } from '@/hooks/api/useAssessments';
import { useAssessmentRubric, useRubricPresets } from '@/hooks/api/useRubrics';
import { GradeEntrySheet } from '@/components/assessments/GradeEntrySheet';
import { PresetSelector } from '@/components/features/rubrics/PresetSelector';
import { RubricBuilder } from '@/components/features/rubrics/RubricBuilder';
import { PullGradesButton } from '@/components/features/google-classroom/PullGradesButton';
import { SyncStatusBadge } from '@/components/features/google-classroom/SyncStatusBadge';
import { LinkAssessmentModal } from '@/components/features/google-classroom/LinkAssessmentModal';
import { useFeaturePermission } from '@/hooks/usePermissions';
import type { CreateRubricCategoryInput } from '@/types/rubrics';

export default function AssessmentGradesPage() {
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const tRubrics = useTranslations('rubrics');
  const tGoogle = useTranslations('googleClassroom');
  const router = useRouter();
  const params = useParams();
  const { canEdit } = useFeaturePermission('assessment');
  const assessmentId =
    (params && typeof (params as Record<string, unknown>).id === 'string'
      ? ((params as Record<string, unknown>).id as string)
      : undefined) ?? '';
  const { data: assessmentData, isLoading } = useAssessment(assessmentId || undefined);
  const assessment = assessmentData;
  const { data: rubricWithScores } = useAssessmentRubric(assessmentId || undefined);
  const { data: presets } = useRubricPresets();
  const [linkOpened, { open: openLink, close: closeLink }] = useDisclosure(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [draftCategories, setDraftCategories] = useState<CreateRubricCategoryInput[] | undefined>();

  const rubric = rubricWithScores?.rubric ?? null;
  const isGoogleLinked = assessment?.gradingSource === 'google_classroom';
  // Alma rubrics stay viewable when Google-linked, but Google is source of truth.
  const canEditExistingRubric = canEdit && !!rubric && !isGoogleLinked;
  const showLinkedRubric = !!rubric && isGoogleLinked;
  const canAttachRubric = canEdit && !rubric && !isGoogleLinked;

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = (presets ?? []).find((p) => p.id === presetId);
    if (!preset) return;
    setDraftCategories(
      preset.categories.map((c, index) => ({
        categoryName: c.categoryName,
        categoryCode: c.categoryCode,
        maxMarks: c.defaultMarks ?? 0,
        sortOrder: c.sortOrder ?? index,
        description: c.description,
      })),
    );
  };

  const builderInitialCategories = useMemo(() => draftCategories, [draftCategories]);

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
          <Title order={1}>{t('gradeEntry')}</Title>
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
        <Group justify="space-between" w="100%" wrap="nowrap" align="flex-start">
          <Title order={1} style={{ flex: 1, minWidth: 0 }} lineClamp={2}>
            {canEdit ? t('gradeEntryTitle', { title: assessment.title }) : t('gradeTitle', { title: assessment.title })}
          </Title>
          <Group gap="xs" style={{ flexShrink: 0 }} wrap="wrap">
            {isGoogleLinked && <SyncStatusBadge assessmentId={assessment.id} />}
            {isGoogleLinked && canEdit && (
              <PullGradesButton assessmentId={assessment.id} />
            )}
            {canEdit && !isGoogleLinked && (
              <Button id="assessment-link-google" variant="light" onClick={openLink}>
                {tGoogle('linkToGoogle')}
              </Button>
            )}
            <Button id="assessment-grades-back" variant="subtle" onClick={() => router.back()}>
              {tCommon('back')}
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
          {canEditExistingRubric && rubric && (
            <Paper p="md" withBorder>
              <RubricBuilder
                assessmentId={assessment.id}
                existingRubric={rubric}
              />
            </Paper>
          )}

          {showLinkedRubric && rubric && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  {tRubrics('googleRubricSyncedHint')}
                </Text>
                <RubricBuilder
                  assessmentId={assessment.id}
                  existingRubric={rubric}
                  disabled
                />
              </Stack>
            </Paper>
          )}

          {canAttachRubric && (
            <Paper p="md" withBorder>
              <Stack gap="md">
                <Text fw={500}>{tRubrics('attachRubric')}</Text>
                <Text size="sm" c="dimmed">
                  {tRubrics('attachRubricHint')}
                </Text>
                <PresetSelector onSelect={handlePresetSelect} />
                <Divider label={tRubrics('customiseMarks')} />
                <RubricBuilder
                  assessmentId={assessment.id}
                  presetId={selectedPresetId}
                  initialCategories={builderInitialCategories}
                  onCreated={() => {
                    setDraftCategories(undefined);
                    setSelectedPresetId(undefined);
                  }}
                />
              </Stack>
            </Paper>
          )}

          <Paper p="md" withBorder>
            <GradeEntrySheet assessment={assessment} readOnly={!canEdit} />
          </Paper>
        </Stack>
      </div>

      <LinkAssessmentModal
        assessment={assessment}
        opened={linkOpened}
        onClose={closeLink}
      />
    </>
  );
}
