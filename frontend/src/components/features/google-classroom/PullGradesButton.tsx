'use client';

import { Button } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { usePullAssessmentGrades } from '@/hooks/api/useGoogleWorkspace';
import { useAssessmentGrades } from '@/hooks/api/useGrades';

interface PullGradesButtonProps {
  assessmentId: string;
  disabled?: boolean;
}

export function PullGradesButton({ assessmentId, disabled = false }: PullGradesButtonProps) {
  const t = useTranslations('googleClassroom');
  const tCommon = useTranslations('common');
  const pullGrades = usePullAssessmentGrades();
  const { data: existingGrades } = useAssessmentGrades(assessmentId);
  const hasExistingGrades = (existingGrades ?? []).some(
    (g) => g.marksObtained != null && Number(g.marksObtained) > 0,
  );

  const runPull = () => {
    pullGrades.mutate(assessmentId, {
      onSuccess: (result) => {
        notifications.show({
          title: tCommon('success'),
          message: t('pullSuccess', {
            synced: result?.synced ?? 0,
            failed: result?.failed ?? 0,
          }),
          color: 'green',
        });
      },
    });
  };

  const handleClick = () => {
    if (hasExistingGrades) {
      modals.openConfirmModal({
        title: t('pullGrades'),
        children: t('pullGradesConfirm'),
        labels: { confirm: tCommon('yes'), cancel: tCommon('cancel') },
        confirmProps: { color: 'red', id: 'google-pull-grades-confirm' },
        onConfirm: runPull,
      });
      return;
    }
    runPull();
  };

  return (
    <Button
      id="google-classroom-pull-grades"
      onClick={handleClick}
      loading={!disabled && pullGrades.isPending}
      disabled={disabled}
    >
      {t('pullGrades')}
    </Button>
  );
}
