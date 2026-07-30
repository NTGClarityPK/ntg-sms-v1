'use client';

import { useEffect, useState } from 'react';
import { Button, Group, NumberInput, Stack, TextInput, ActionIcon, Text } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  useCreateAssessmentRubric,
  useDeleteAssessmentRubric,
  useUpdateAssessmentRubric,
} from '@/hooks/api/useRubrics';
import type {
  AssessmentRubric,
  CreateRubricCategoryInput,
  UpdateRubricCategoryInput,
} from '@/types/rubrics';

interface RubricBuilderProps {
  assessmentId: string;
  presetId?: string;
  /** When provided, builder edits an existing assessment rubric. */
  existingRubric?: AssessmentRubric | null;
  /** Prefill categories (e.g. from a preset) before create. */
  initialCategories?: CreateRubricCategoryInput[];
  onCreated?: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
  disabled?: boolean;
}

interface CategoryDraft {
  key: string;
  id?: string;
  categoryName: string;
  categoryCode: string;
  maxMarks: number;
}

function emptyCategory(index: number): CategoryDraft {
  return {
    key: `cat-${index}-${Date.now()}`,
    categoryName: '',
    categoryCode: '',
    maxMarks: 0,
  };
}

function draftsFromInitial(initial?: CreateRubricCategoryInput[]): CategoryDraft[] {
  if (!initial?.length) return [emptyCategory(0)];
  return initial.map((c, index) => ({
    key: `init-${index}-${c.categoryName}`,
    categoryName: c.categoryName,
    categoryCode: c.categoryCode ?? '',
    maxMarks: Number(c.maxMarks) || 0,
  }));
}

function draftsFromRubric(rubric: AssessmentRubric): CategoryDraft[] {
  return rubric.categories.map((c, index) => ({
    key: c.id || `existing-${index}`,
    id: c.id,
    categoryName: c.categoryName,
    categoryCode: c.categoryCode ?? '',
    maxMarks: Number(c.maxMarks) || 0,
  }));
}

export function RubricBuilder({
  assessmentId,
  presetId,
  existingRubric,
  initialCategories,
  onCreated,
  onUpdated,
  onDeleted,
  disabled = false,
}: RubricBuilderProps) {
  const t = useTranslations('rubrics');
  const createRubric = useCreateAssessmentRubric(assessmentId);
  const updateRubric = useUpdateAssessmentRubric(assessmentId);
  const deleteRubric = useDeleteAssessmentRubric(assessmentId);
  const isEdit = !!existingRubric;

  const [categories, setCategories] = useState<CategoryDraft[]>(() =>
    existingRubric
      ? draftsFromRubric(existingRubric)
      : draftsFromInitial(initialCategories),
  );

  useEffect(() => {
    if (existingRubric) {
      setCategories(draftsFromRubric(existingRubric));
      return;
    }
    if (initialCategories?.length) {
      setCategories(draftsFromInitial(initialCategories));
    }
  }, [existingRubric, initialCategories]);

  const totalMarks = categories.reduce((sum, c) => sum + (Number(c.maxMarks) || 0), 0);

  const updateCategory = (key: string, patch: Partial<CategoryDraft>) => {
    setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const handleSubmit = () => {
    const payload = categories
      .filter((c) => c.categoryName.trim())
      .map((c, index) => ({
        id: c.id,
        categoryName: c.categoryName.trim(),
        categoryCode: c.categoryCode.trim() || undefined,
        maxMarks: Number(c.maxMarks) || 0,
        sortOrder: index,
      }));

    if (payload.length === 0) return;

    if (isEdit) {
      updateRubric.mutate(
        { categories: payload as UpdateRubricCategoryInput[] },
        { onSuccess: () => onUpdated?.() },
      );
      return;
    }

    createRubric.mutate(
      {
        presetId,
        categories: payload.map(({ id: _id, ...rest }) => rest),
      },
      {
        onSuccess: () => {
          onCreated?.();
          setCategories([emptyCategory(0)]);
        },
      },
    );
  };

  const pending =
    createRubric.isPending || updateRubric.isPending || deleteRubric.isPending;

  return (
    <Stack gap="md">
      <Text fw={500}>{isEdit ? t('editRubric') : t('customRubric')}</Text>
      <Text size="sm" c="dimmed">
        {t('marksFlexibleHint')}
      </Text>
      {categories.map((cat, index) => (
        <Group key={cat.key} align="flex-end" wrap="wrap" gap="sm">
          <TextInput
            id={`rubric-builder-name-${index}`}
            label={t('categoryName')}
            value={cat.categoryName}
            onChange={(e) => updateCategory(cat.key, { categoryName: e.currentTarget.value })}
            disabled={disabled}
            style={{ flex: 2, minWidth: 160 }}
          />
          <TextInput
            id={`rubric-builder-code-${index}`}
            label={t('categoryCode')}
            value={cat.categoryCode}
            onChange={(e) => updateCategory(cat.key, { categoryCode: e.currentTarget.value })}
            disabled={disabled}
            style={{ flex: 1, minWidth: 80 }}
          />
          <NumberInput
            id={`rubric-builder-max-${index}`}
            label={t('maxMarks')}
            value={cat.maxMarks}
            onChange={(value) =>
              updateCategory(cat.key, {
                maxMarks: typeof value === 'number' ? value : Number(value) || 0,
              })
            }
            min={0}
            disabled={disabled}
            style={{ width: 120 }}
          />
          <ActionIcon
            id={`rubric-builder-remove-${index}`}
            variant="subtle"
            color="red"
            disabled={disabled || categories.length <= 1}
            onClick={() => setCategories((prev) => prev.filter((c) => c.key !== cat.key))}
            aria-label={t('deleteRubric')}
            style={disabled ? { visibility: 'hidden' } : undefined}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}

      <Group justify="space-between" wrap="wrap">
        {!disabled && (
          <Button
            id="rubric-builder-add-category"
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setCategories((prev) => [...prev, emptyCategory(prev.length)])}
          >
            {t('addCategory')}
          </Button>
        )}
        <Text size="sm" c="dimmed">
          {t('totalMarks')}: {totalMarks}
        </Text>
      </Group>

      {!disabled && (
        <Group justify="flex-end" wrap="wrap">
          {isEdit && (
            <Button
              id="rubric-builder-delete"
              variant="subtle"
              color="red"
              loading={deleteRubric.isPending}
              onClick={() =>
                deleteRubric.mutate(undefined, {
                  onSuccess: () => onDeleted?.(),
                })
              }
            >
              {t('deleteRubric')}
            </Button>
          )}
          <Button
            id="rubric-builder-create"
            onClick={handleSubmit}
            loading={pending && !deleteRubric.isPending}
            disabled={categories.every((c) => !c.categoryName.trim())}
          >
            {isEdit ? t('saveRubric') : t('createRubric')}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
