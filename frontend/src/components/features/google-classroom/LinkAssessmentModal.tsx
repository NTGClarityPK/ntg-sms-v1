'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Modal, Select, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import {
  useGoogleCoursework,
  useGoogleMappings,
  useLinkAssessmentGoogle,
} from '@/hooks/api/useGoogleWorkspace';
import type { Assessment } from '@/types/assessment';

interface LinkAssessmentModalProps {
  assessment: Assessment;
  opened: boolean;
  onClose: () => void;
}

export function LinkAssessmentModal({ assessment, opened, onClose }: LinkAssessmentModalProps) {
  const t = useTranslations('googleClassroom');
  const tCommon = useTranslations('common');
  const { data: mappings } = useGoogleMappings();
  const linkAssessment = useLinkAssessmentGoogle();
  const [courseworkId, setCourseworkId] = useState<string | null>(null);

  const mapping = useMemo(
    () =>
      (mappings ?? []).find(
        (m) =>
          m.classSectionId === assessment.classSectionId &&
          m.subjectId === assessment.subjectId &&
          m.isActive,
      ),
    [mappings, assessment.classSectionId, assessment.subjectId],
  );

  const { data: coursework, isLoading: courseworkLoading } = useGoogleCoursework(
    opened ? mapping?.googleCourseId : undefined,
  );

  const options = (coursework ?? []).map((cw) => ({
    value: cw.id,
    label: cw.maxPoints != null ? `${cw.title} (${cw.maxPoints})` : cw.title,
  }));

  const handleLink = () => {
    if (!courseworkId) return;
    linkAssessment.mutate(
      { assessmentId: assessment.id, googleCourseworkId: courseworkId },
      {
        onSuccess: () => {
          setCourseworkId(null);
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('linkToGoogle')}
      id="google-link-assessment-modal"
    >
      <Stack gap="md">
        {!mapping ? (
          <Alert color="yellow">{t('notMapped')}</Alert>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              {mapping.googleCourseName || mapping.googleCourseId}
            </Text>
            <Select
              id="google-link-coursework"
              label={t('googleCourse')}
              placeholder={tCommon('select')}
              data={options}
              value={courseworkId}
              onChange={setCourseworkId}
              searchable
              disabled={courseworkLoading}
            />
            <Button
              id="google-link-confirm"
              onClick={handleLink}
              loading={linkAssessment.isPending}
              disabled={!courseworkId}
            >
              {t('linkToGoogle')}
            </Button>
          </>
        )}
      </Stack>
    </Modal>
  );
}
