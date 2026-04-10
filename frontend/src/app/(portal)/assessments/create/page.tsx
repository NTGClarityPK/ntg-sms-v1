'use client';

/**
 * Create Assessment Page
 * Materials are stored in draft as-is. When teacher presses Create Assessment, we compress all (with progress), then create and commit draft.
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Title, Paper, Button, Group, Stack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { AssessmentForm } from '@/components/assessments/AssessmentForm';
import { useCreateAssessment } from '@/hooks/api/useAssessments';
import { useCompressDraftFile } from '@/hooks/api/useAssessmentAttachments';
import { useFeaturePermission } from '@/hooks/usePermissions';
import { notifications } from '@mantine/notifications';
import type { CreateAssessmentInput, UpdateAssessmentInput } from '@/types/assessment';
import type { Assessment } from '@/types/assessment';
import type { StagedDraftFile } from '@/types/assessment';

export default function CreateAssessmentPage() {
  const t = useTranslations('assessment');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { canEdit } = useFeaturePermission('assessment');
  const [draftId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const createAssessment = useCreateAssessment();
  const compressDraftFile = useCompressDraftFile(draftId);
  const [stagedFiles, setStagedFiles] = useState<StagedDraftFile[]>([]);
  const [compressionProgress, setCompressionProgress] = useState<number | null>(null);
  const [compressionMessage, setCompressionMessage] = useState(t('compressingMaterials'));
  const progressMaxRef = useRef(25);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hadCompressionPhaseRef = useRef(false);
  const progressTickRef = useRef(0);
  const filesCompletedRef = useRef(0);
  const totalFilesRef = useRef(1);

  const clearProgressInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (!canEdit) router.replace('/assessments');
    return clearProgressInterval;
  }, [canEdit, router]);

  const handleSubmit = async (values: CreateAssessmentInput | UpdateAssessmentInput) => {
    const payload: CreateAssessmentInput = {
      ...(values as CreateAssessmentInput),
      draftId: stagedFiles.length > 0 ? draftId : undefined,
    };

    if (stagedFiles.length > 0) {
      hadCompressionPhaseRef.current = true;
      const total = stagedFiles.length;
      totalFilesRef.current = total;
      filesCompletedRef.current = 0;
      progressTickRef.current = 0;
      progressMaxRef.current = 25;
      setCompressionProgress(15);
      setCompressionMessage(t('preparing'));

      progressIntervalRef.current = setInterval(() => {
        progressTickRef.current += 1;
        const tick = progressTickRef.current;
        const completed = filesCompletedRef.current;
        const totalF = totalFilesRef.current;
        const timeBasedCap = Math.min(25 + Math.min(tick, 20) * 3, 65);
        const actualCap = totalF > 0 ? (completed / totalF) * 70 : 0;
        progressMaxRef.current = Math.max(timeBasedCap, actualCap);
        setCompressionProgress((prev) => {
          const next = Math.min((prev ?? 0) + 3, progressMaxRef.current);
          return next;
        });
      }, 500);

      try {
        for (let i = 0; i < stagedFiles.length; i++) {
          await compressDraftFile.mutateAsync(stagedFiles[i].draftFileId);
          filesCompletedRef.current = i + 1;
          const newCap = ((i + 1) / total) * 70;
          progressMaxRef.current = newCap;
          setCompressionProgress((prev) => Math.max(prev ?? 0, newCap));
          setCompressionMessage(
            total === 1
              ? t('compressingMaterials')
              : t('compressingProgress', { current: i + 1, total }),
          );
        }
      } catch {
        clearProgressInterval();
        setCompressionProgress(null);
        return;
      }

      clearProgressInterval();
      setCompressionProgress(85);
      setCompressionMessage(t('creatingAssessment'));
    }

    createAssessment.mutate(payload, {
      onSuccess: (response) => {
        clearProgressInterval();
        if (hadCompressionPhaseRef.current) {
          hadCompressionPhaseRef.current = false;
          setCompressionProgress(100);
          setCompressionMessage(t('done'));
          setTimeout(() => setCompressionProgress(null), 400);
        } else {
          setCompressionProgress(null);
        }
        // QA expectation: after successful create, redirect back to assessment list.
        // We still attempt to read the id so we can surface a clearer error if the API response is unexpected.
        const assessment =
          (response as unknown as { data?: Assessment })?.data ??
          (response as unknown as Assessment);
        if (!assessment?.id) {
          notifications.show({
            title: t('error'),
            message: t('errorCreatedNoId'),
            color: 'red',
          });
        }
        router.push('/assessments');
      },
      onError: (error: Error & { response?: { data?: { message?: string } } }) => {
        clearProgressInterval();
        setCompressionProgress(null);
        const message = error.response?.data?.message ?? error.message ?? '';
        if (message.includes('10MB') || message.includes('10 MB')) {
          notifications.show({
            title: t('materialsLimitExceeded'),
            message: t('materialsLimitMessage'),
            color: 'red',
            autoClose: 8000,
          });
        } else {
          notifications.show({
            title: t('error'),
            message: message || t('failedToCreate'),
            color: 'red',
          });
        }
      },
    });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('createAssessmentTitle')}</Title>
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
              onSubmit={handleSubmit}
              isLoading={createAssessment.isPending || compressionProgress !== null}
              compressionProgress={compressionProgress}
              compressionMessage={compressionMessage}
              draftId={draftId}
              stagedFiles={stagedFiles}
              onStagedFilesChange={setStagedFiles}
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
