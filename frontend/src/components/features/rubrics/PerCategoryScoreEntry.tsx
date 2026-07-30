'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Group, NumberInput, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useUpsertStudentRubricScores } from '@/hooks/api/useRubrics';
import type { RubricCategory, StudentRubricScore } from '@/types/rubrics';

interface PerCategoryScoreEntryProps {
  studentGradeId: string;
  categories: RubricCategory[];
  existingScores?: StudentRubricScore[];
  readOnly?: boolean;
  onSaved?: (total: number) => void;
}

export function PerCategoryScoreEntry({
  studentGradeId,
  categories,
  existingScores = [],
  readOnly = false,
  onSaved,
}: PerCategoryScoreEntryProps) {
  const t = useTranslations('rubrics');
  const tCommon = useTranslations('common');
  const upsert = useUpsertStudentRubricScores();
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const [marks, setMarks] = useState<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const cat of sorted) {
      const existing = existingScores.find((s) => s.rubricCategoryId === cat.id);
      next[cat.id] = existing?.marksObtained ?? 0;
    }
    setMarks(next);
  }, [sorted, existingScores, studentGradeId]);

  const runningTotal = Object.values(marks).reduce((sum, n) => sum + (Number(n) || 0), 0);

  const handleSave = () => {
    upsert.mutate(
      {
        studentGradeId,
        input: {
          scores: sorted.map((cat) => ({
            categoryId: cat.id,
            marksObtained: Number(marks[cat.id]) || 0,
          })),
        },
      },
      {
        onSuccess: () => {
          onSaved?.(runningTotal);
        },
      },
    );
  };

  return (
    <Stack gap="sm">
      {sorted.map((cat) => (
        <NumberInput
          key={cat.id}
          id={`rubric-score-${studentGradeId}-${cat.id}`}
          label={`${cat.categoryName}${cat.categoryCode ? ` (${cat.categoryCode})` : ''} / ${cat.maxMarks}`}
          value={marks[cat.id] ?? 0}
          onChange={(value) => {
            const n = typeof value === 'number' ? value : Number(value);
            setMarks((prev) => ({
              ...prev,
              [cat.id]: Number.isFinite(n) ? n : 0,
            }));
          }}
          min={0}
          max={cat.maxMarks}
          disabled={readOnly}
          size="sm"
        />
      ))}
      <Group justify="space-between" wrap="wrap">
        <Text size="sm" fw={500}>
          {t('totalMarks')}: {runningTotal}
        </Text>
        {!readOnly && (
          <Button
            id={`rubric-score-save-${studentGradeId}`}
            size="xs"
            onClick={handleSave}
            loading={!readOnly && upsert.isPending}
          >
            {tCommon('save')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}
