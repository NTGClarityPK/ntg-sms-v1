'use client';

import { Alert, Button, Group, Paper, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { modals } from '@mantine/modals';
import {
  useAddFrameworkCategory,
  useDeleteFrameworkCategory,
  useUpdateFrameworkCategory,
  useUpdateFrameworkPreset,
} from '@/hooks/useBehavioralFramework';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import type { FrameworkPreset, RatingScaleLevel } from '@/types/behavioral-framework';
import { CategoryEditor, toCategoryDrafts, type CategoryDraft } from './CategoryEditor';
import { RatingScaleEditor } from './RatingScaleEditor';

interface FrameworkCustomizerProps {
  preset: FrameworkPreset;
}

export function FrameworkCustomizer({ preset }: FrameworkCustomizerProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const notifyColors = useNotificationColors();

  const updatePreset = useUpdateFrameworkPreset();
  const addCategory = useAddFrameworkCategory();
  const updateCategory = useUpdateFrameworkCategory();
  const deleteCategory = useDeleteFrameworkCategory();

  const [presetName, setPresetName] = useState(preset.presetName);
  const [description, setDescription] = useState(preset.description ?? '');
  const [commentsRequired, setCommentsRequired] = useState(preset.commentsRequired);
  const [scale, setScale] = useState<RatingScaleLevel[]>(
    [...preset.defaultRatingScale].sort((a, b) => a.order - b.order),
  );
  const [categories, setCategories] = useState<CategoryDraft[]>(
    toCategoryDrafts(preset.categories),
  );
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPresetName(preset.presetName);
    setDescription(preset.description ?? '');
    setCommentsRequired(preset.commentsRequired);
    setScale([...preset.defaultRatingScale].sort((a, b) => a.order - b.order));
    setCategories(toCategoryDrafts(preset.categories));
  }, [preset]);

  const handleDeleteCategory = (categoryId: string) => {
    modals.openConfirmModal({
      title: t('behaviorFrameworkCategoryRemove'),
      centered: true,
      children: (
        <Text size="sm">{t('behaviorFrameworkCategoryDeleteConfirm')}</Text>
      ),
      labels: {
        confirm: tCommon('delete'),
        cancel: tCommon('cancel'),
      },
      confirmProps: {
        color: 'red',
        id: `behavior-framework-category-delete-confirm-${categoryId}`,
      },
      cancelProps: {
        id: `behavior-framework-category-delete-cancel-${categoryId}`,
      },
      onConfirm: async () => {
        try {
          setDeletingCategoryId(categoryId);
          await deleteCategory.mutateAsync(categoryId);
          setCategories((prev) => prev.filter((c) => c.id !== categoryId));
        } finally {
          setDeletingCategoryId(null);
        }
      },
    });
  };

  const onSave = async () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) return;

    const cleanedScale = scale
      .map((l, index) => ({
        code: l.code.trim(),
        label: l.label.trim(),
        order: l.order,
      }))
      .filter((l) => l.code && l.label);

    if (cleanedScale.length === 0) return;

    const namedCategories = categories.filter((c) => c.categoryName.trim().length > 0);
    if (namedCategories.length === 0) return;

    setSaving(true);
    try {
      await updatePreset.mutateAsync({
        id: preset.id,
        input: {
          presetName: trimmedName,
          description: description.trim() || undefined,
          commentsRequired,
          defaultRatingScale: cleanedScale,
        },
        silent: true,
      });

      for (const cat of namedCategories) {
        const payload = {
          categoryName: cat.categoryName.trim(),
          description: cat.description.trim() || undefined,
          sortOrder: cat.sortOrder,
          indicators: cat.indicators,
        };
        if (cat.id) {
          await updateCategory.mutateAsync({ id: cat.id, input: payload, silent: true });
        } else {
          await addCategory.mutateAsync({
            presetId: preset.id,
            input: payload,
            silent: true,
          });
        }
      }

      notifications.show({
        title: tCommon('success'),
        message: t('behaviorFrameworkPresetSaved'),
        color: notifyColors.success,
      });
    } catch {
      // Error toasts come from mutation onError handlers
    } finally {
      setSaving(false);
    }
  };

  if (preset.isGlobal) {
    return (
      <Alert id="behavior-framework-global-readonly" color="yellow">
        {t('behaviorFrameworkGlobalReadOnly')}
      </Alert>
    );
  }

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={600}>{t('behaviorFrameworkCustomizerTitle')}</Text>
          <Text size="sm" c="dimmed">
            {t('behaviorFrameworkCustomizerHint')}
          </Text>
        </Stack>

        <TextInput
          id="behavior-framework-preset-name"
          label={t('behaviorFrameworkPresetName')}
          value={presetName}
          onChange={(e) => setPresetName(e.currentTarget.value)}
        />
        <Textarea
          id="behavior-framework-preset-description"
          label={t('behaviorFrameworkPresetDescription')}
          value={description}
          minRows={2}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Switch
          id="behavior-framework-comments-required"
          label={t('behaviorFrameworkCommentsRequired')}
          checked={commentsRequired}
          onChange={(e) => setCommentsRequired(e.currentTarget.checked)}
        />

        <RatingScaleEditor levels={scale} onChange={setScale} />

        <CategoryEditor
          categories={categories}
          onChange={setCategories}
          onDeleteExisting={handleDeleteCategory}
          deletingCategoryId={deletingCategoryId}
        />

        <Group justify="flex-end">
          <Button
            id="behavior-framework-preset-save"
            variant="light"
            onClick={onSave}
            loading={saving}
          >
            {t('behaviorFrameworkSaveFramework')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
