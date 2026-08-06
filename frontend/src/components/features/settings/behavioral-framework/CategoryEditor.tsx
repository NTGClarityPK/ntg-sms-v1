'use client';

import {
  Accordion,
  ActionIcon,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FrameworkCategory } from '@/types/behavioral-framework';

export type CategoryDraft = {
  id?: string;
  categoryName: string;
  description: string;
  sortOrder: number;
  indicators: string[];
  /** Local key for unsaved rows */
  clientKey: string;
};

interface CategoryEditorProps {
  categories: CategoryDraft[];
  onChange: (categories: CategoryDraft[]) => void;
  onDeleteExisting?: (categoryId: string) => void;
  deletingCategoryId?: string | null;
}

export function toCategoryDrafts(categories: FrameworkCategory[]): CategoryDraft[] {
  return categories
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      id: c.id,
      categoryName: c.categoryName,
      description: c.description ?? '',
      sortOrder: c.sortOrder,
      indicators: [...c.indicators],
      clientKey: c.id,
    }));
}

export function CategoryEditor({
  categories,
  onChange,
  onDeleteExisting,
  deletingCategoryId = null,
}: CategoryEditorProps) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [newIndicatorByKey, setNewIndicatorByKey] = useState<Record<string, string>>({});

  const updateCategory = (clientKey: string, patch: Partial<CategoryDraft>) => {
    onChange(
      categories.map((c) => (c.clientKey === clientKey ? { ...c, ...patch } : c)),
    );
  };

  const removeCategory = (draft: CategoryDraft) => {
    if (draft.id && onDeleteExisting) {
      onDeleteExisting(draft.id);
      return;
    }
    onChange(categories.filter((c) => c.clientKey !== draft.clientKey));
  };

  const addCategory = () => {
    const nextOrder =
      categories.length === 0
        ? 0
        : Math.max(...categories.map((c) => c.sortOrder)) + 1;
    onChange([
      ...categories,
      {
        categoryName: '',
        description: '',
        sortOrder: nextOrder,
        indicators: [],
        clientKey: `new-${Date.now()}-${nextOrder}`,
      },
    ]);
  };

  const addIndicator = (clientKey: string) => {
    const text = (newIndicatorByKey[clientKey] ?? '').trim();
    if (!text) return;
    const cat = categories.find((c) => c.clientKey === clientKey);
    if (!cat) return;
    if (cat.indicators.includes(text)) return;
    updateCategory(clientKey, { indicators: [...cat.indicators, text] });
    setNewIndicatorByKey((prev) => ({ ...prev, [clientKey]: '' }));
  };

  const removeIndicator = (clientKey: string, indicator: string) => {
    const cat = categories.find((c) => c.clientKey === clientKey);
    if (!cat) return;
    updateCategory(clientKey, {
      indicators: cat.indicators.filter((i) => i !== indicator),
    });
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {t('behaviorFrameworkCategoriesTitle')}
        </Text>
        <Button
          id="behavior-framework-category-add"
          variant="light"
          size="xs"
          onClick={addCategory}
        >
          {t('behaviorFrameworkCategoryAdd')}
        </Button>
      </Group>

      {categories.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('behaviorFrameworkCategoriesEmpty')}
        </Text>
      ) : (
        <Accordion variant="contained" multiple>
          {categories.map((cat, index) => (
            <Accordion.Item key={cat.clientKey} value={cat.clientKey}>
              <Accordion.Control id={`behavior-framework-category-${index}-toggle`}>
                {cat.categoryName.trim() || t('behaviorFrameworkCategoryUntitled')}
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <TextInput
                    id={`behavior-framework-category-${index}-name`}
                    label={t('behaviorFrameworkCategoryName')}
                    value={cat.categoryName}
                    onChange={(e) =>
                      updateCategory(cat.clientKey, {
                        categoryName: e.currentTarget.value,
                      })
                    }
                  />
                  <Textarea
                    id={`behavior-framework-category-${index}-description`}
                    label={t('behaviorFrameworkCategoryDescription')}
                    value={cat.description}
                    minRows={2}
                    onChange={(e) =>
                      updateCategory(cat.clientKey, {
                        description: e.currentTarget.value,
                      })
                    }
                  />

                  <Text size="xs" fw={500}>
                    {t('behaviorFrameworkIndicatorsTitle')}
                  </Text>
                  <Stack gap="xs">
                    {cat.indicators.map((indicator) => (
                      <Group key={indicator} justify="space-between" wrap="nowrap">
                        <Text size="sm" style={{ flex: 1 }}>
                          {indicator}
                        </Text>
                        <ActionIcon
                          id={`behavior-framework-category-${index}-indicator-remove-${indicator.slice(0, 12).replace(/\s+/g, '-')}`}
                          variant="subtle"
                          color="red"
                          onClick={() => removeIndicator(cat.clientKey, indicator)}
                          aria-label={tCommon('remove')}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                  <Group align="flex-end">
                    <TextInput
                      id={`behavior-framework-category-${index}-indicator-input`}
                      label={t('behaviorFrameworkIndicatorAdd')}
                      value={newIndicatorByKey[cat.clientKey] ?? ''}
                      onChange={(e) =>
                        setNewIndicatorByKey((prev) => ({
                          ...prev,
                          [cat.clientKey]: e.currentTarget.value,
                        }))
                      }
                      style={{ flex: 1 }}
                    />
                    <Button
                      id={`behavior-framework-category-${index}-indicator-add`}
                      variant="light"
                      onClick={() => addIndicator(cat.clientKey)}
                    >
                      {tCommon('add')}
                    </Button>
                  </Group>

                  <Group justify="flex-end">
                    <Button
                      id={`behavior-framework-category-${index}-remove`}
                      variant="light"
                      color="red"
                      loading={
                        !!cat.id &&
                        deletingCategoryId === cat.id
                      }
                      disabled={
                        !!deletingCategoryId && deletingCategoryId !== cat.id
                      }
                      onClick={() => removeCategory(cat)}
                    >
                      {t('behaviorFrameworkCategoryRemove')}
                    </Button>
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
