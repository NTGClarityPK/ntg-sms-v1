'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Modal,
  Radio,
  Stack,
  Text,
  Textarea,
  List,
  Divider,
  Group,
} from '@mantine/core';
import {
  useCreateFrameworkRating,
  useUpdateFrameworkRating,
} from '@/hooks/useBehavioralFramework';
import type {
  ClassFrameworkReportStudent,
  FrameworkPreset,
  FrameworkRating,
} from '@/types/behavioral-framework';

interface StudentFrameworkRatingFormProps {
  opened: boolean;
  onClose: () => void;
  student: ClassFrameworkReportStudent;
  assessmentMonth: string;
  preset: FrameworkPreset;
  existingRating?: FrameworkRating;
  onSaved?: () => void;
}

type ScoreDraft = {
  ratingCode: string;
  teacherComment: string;
};

export function StudentFrameworkRatingForm({
  opened,
  onClose,
  student,
  assessmentMonth,
  preset,
  existingRating,
  onSaved,
}: StudentFrameworkRatingFormProps) {
  const t = useTranslations('behavioral');
  const createMutation = useCreateFrameworkRating();
  const updateMutation = useUpdateFrameworkRating();

  const categories = useMemo(
    () => [...preset.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [preset.categories],
  );
  const scale = useMemo(
    () => [...preset.defaultRatingScale].sort((a, b) => a.order - b.order),
    [preset.defaultRatingScale],
  );

  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    const next: Record<string, ScoreDraft> = {};
    for (const cat of categories) {
      const existing = existingRating?.categoryScores.find((s) => s.categoryId === cat.id);
      next[cat.id] = {
        ratingCode: existing?.ratingCode ?? '',
        teacherComment: existing?.teacherComment ?? '',
      };
    }
    setDrafts(next);
    setValidationError(null);
  }, [opened, categories, existingRating]);

  const studentName =
    `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || student.schoolStudentId;

  const updateDraft = (categoryId: string, patch: Partial<ScoreDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [categoryId]: { ...(prev[categoryId] ?? { ratingCode: '', teacherComment: '' }), ...patch },
    }));
  };

  const handleSave = async () => {
    for (const cat of categories) {
      const draft = drafts[cat.id];
      if (!draft?.ratingCode) {
        setValidationError(t('frameworkValidationMissingCode', { category: cat.categoryName }));
        return;
      }
      if (preset.commentsRequired && !draft.teacherComment.trim()) {
        setValidationError(
          t('frameworkValidationMissingComment', { category: cat.categoryName }),
        );
        return;
      }
    }
    setValidationError(null);

    const categoryScores = categories.map((cat) => ({
      categoryId: cat.id,
      ratingCode: drafts[cat.id].ratingCode,
      teacherComment: drafts[cat.id].teacherComment.trim() || undefined,
    }));

    if (existingRating) {
      await updateMutation.mutateAsync({
        id: existingRating.id,
        input: { categoryScores },
      });
    } else {
      await createMutation.mutateAsync({
        studentId: student.studentId,
        assessmentMonth,
        categoryScores,
      });
    }
    onSaved?.();
    onClose();
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      id="behavior-framework-rating-modal"
      opened={opened}
      onClose={onClose}
      title={t('frameworkRateStudentTitle', { name: studentName })}
      size="lg"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t('frameworkRateStudentMonth', { month: assessmentMonth.slice(0, 7) })}
        </Text>

        {validationError ? (
          <Alert color="red" id="behavior-framework-rating-validation">
            {validationError}
          </Alert>
        ) : null}

        {categories.map((cat, index) => {
          const draft = drafts[cat.id] ?? { ratingCode: '', teacherComment: '' };
          return (
            <Stack key={cat.id} gap="xs">
              {index > 0 ? <Divider /> : null}
              <Text fw={600}>{cat.categoryName}</Text>
              {cat.description ? (
                <Text size="xs" c="dimmed">
                  {cat.description}
                </Text>
              ) : null}

              <Radio.Group
                id={`behavior-framework-rating-cat-${index}-scale`}
                value={draft.ratingCode}
                onChange={(value) => updateDraft(cat.id, { ratingCode: value })}
                label={t('frameworkRatingScale')}
              >
                <Stack gap="xs" mt="xs">
                  {scale.map((level) => (
                    <Radio
                      key={level.code}
                      id={`behavior-framework-rating-cat-${index}-code-${level.code}`}
                      value={level.code}
                      label={`${level.code} — ${level.label}`}
                    />
                  ))}
                </Stack>
              </Radio.Group>

              {cat.indicators.length > 0 ? (
                <Stack gap={4}>
                  <Text size="xs" fw={500}>
                    {t('frameworkIndicators')}
                  </Text>
                  <List size="xs" spacing={2}>
                    {cat.indicators.map((indicator) => (
                      <List.Item key={indicator}>{indicator}</List.Item>
                    ))}
                  </List>
                </Stack>
              ) : null}

              <Textarea
                id={`behavior-framework-rating-cat-${index}-comment`}
                label={
                  preset.commentsRequired
                    ? t('frameworkCommentRequired')
                    : t('frameworkCommentOptional')
                }
                value={draft.teacherComment}
                minRows={2}
                onChange={(e) =>
                  updateDraft(cat.id, { teacherComment: e.currentTarget.value })
                }
              />
            </Stack>
          );
        })}

        <Group justify="flex-end">
          <Button
            id="behavior-framework-rating-cancel"
            variant="default"
            onClick={onClose}
            disabled={saving}
          >
            {t('frameworkCancel')}
          </Button>
          <Button
            id="behavior-framework-rating-save"
            variant="light"
            onClick={() => {
              void handleSave();
            }}
            loading={saving}
          >
            {t('save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
