'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  NumberInput,
  Paper,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FeatureToggle } from '@/components/features/google-classroom/FeatureToggle';
import { ConnectionCard } from '@/components/features/google-classroom/ConnectionCard';
import { CourseMappingTable } from '@/components/features/google-classroom/CourseMappingTable';
import { RubricBreakdownDisplay } from '@/components/features/rubrics/RubricBreakdownDisplay';
import {
  useAutoSuggestGoogleMappings,
  useCreateGoogleMapping,
  useGoogleWorkspaceSettings,
} from '@/hooks/api/useGoogleWorkspace';
import {
  useCreateRubricPreset,
  useRubricPresets,
  useUpdateRubricPreset,
} from '@/hooks/api/useRubrics';
import type { GoogleMappingSuggestion } from '@/types/google-workspace';
import type {
  CreateRubricPresetCategoryInput,
  RubricPreset,
} from '@/types/rubrics';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface CategoryDraft {
  key: string;
  categoryName: string;
  categoryCode: string;
  defaultMarks: number;
}

function emptyCategory(index: number): CategoryDraft {
  return {
    key: `preset-cat-${index}-${Date.now()}`,
    categoryName: '',
    categoryCode: '',
    defaultMarks: 0,
  };
}

function draftsFromPreset(preset: RubricPreset): CategoryDraft[] {
  return preset.categories.map((c, index) => ({
    key: c.id || `preset-${preset.id}-${index}`,
    categoryName: c.categoryName,
    categoryCode: c.categoryCode ?? '',
    defaultMarks: Number(c.defaultMarks) || 0,
  }));
}

function EditablePresetCard({ preset }: { preset: RubricPreset }) {
  const tRubrics = useTranslations('rubrics');
  const tCommon = useTranslations('common');
  const updatePreset = useUpdateRubricPreset();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(preset.presetName);
  const [categories, setCategories] = useState<CategoryDraft[]>(() =>
    draftsFromPreset(preset),
  );

  useEffect(() => {
    if (!editing) {
      setName(preset.presetName);
      setCategories(draftsFromPreset(preset));
    }
  }, [preset, editing]);

  const totalMarks = categories.reduce((sum, c) => sum + (Number(c.defaultMarks) || 0), 0);

  const handleSave = () => {
    const cats: CreateRubricPresetCategoryInput[] = categories
      .filter((c) => c.categoryName.trim())
      .map((c, index) => ({
        categoryName: c.categoryName.trim(),
        categoryCode: c.categoryCode.trim() || undefined,
        defaultMarks: Number(c.defaultMarks) || 0,
        sortOrder: index,
      }));
    if (cats.length === 0) return;

    updatePreset.mutate(
      {
        id: preset.id,
        input: {
          presetName: name.trim() || preset.presetName,
          categories: cats,
        },
      },
      {
        onSuccess: () => setEditing(false),
      },
    );
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={600}>
            {preset.presetName}
            {preset.isGlobal ? ` (${tRubrics('globalPreset')})` : ''}
          </Text>
          <Text size="xs" c="dimmed">
            {tRubrics('presetDefaultsHint')}
          </Text>
        </div>
        {!editing ? (
          <Button
            id={`rubric-preset-edit-${preset.id}`}
            size="xs"
            variant="light"
            onClick={() => setEditing(true)}
          >
            {tCommon('edit')}
          </Button>
        ) : (
          <Group gap="xs">
            <Button
              id={`rubric-preset-cancel-${preset.id}`}
              size="xs"
              variant="default"
              onClick={() => setEditing(false)}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              id={`rubric-preset-save-${preset.id}`}
              size="xs"
              loading={updatePreset.isPending}
              onClick={handleSave}
            >
              {tCommon('save')}
            </Button>
          </Group>
        )}
      </Group>

      {!editing ? (
        <RubricBreakdownDisplay
          categories={preset.categories.map((c) => ({
            id: c.id,
            categoryName: c.categoryName,
            categoryCode: c.categoryCode,
            maxMarks: c.defaultMarks ?? 0,
            sortOrder: c.sortOrder,
            description: c.description,
          }))}
        />
      ) : (
        <Stack gap="sm">
          <TextInput
            id={`rubric-preset-edit-name-${preset.id}`}
            label={tRubrics('presetName')}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          {categories.map((cat, index) => (
            <Group key={cat.key} align="flex-end" wrap="wrap" gap="sm">
              <TextInput
                id={`rubric-preset-edit-cat-name-${preset.id}-${index}`}
                label={tRubrics('categoryName')}
                value={cat.categoryName}
                onChange={(e) =>
                  setCategories((prev) =>
                    prev.map((c) =>
                      c.key === cat.key ? { ...c, categoryName: e.currentTarget.value } : c,
                    ),
                  )
                }
                style={{ flex: 2, minWidth: 160 }}
              />
              <TextInput
                id={`rubric-preset-edit-cat-code-${preset.id}-${index}`}
                label={tRubrics('categoryCode')}
                value={cat.categoryCode}
                onChange={(e) =>
                  setCategories((prev) =>
                    prev.map((c) =>
                      c.key === cat.key ? { ...c, categoryCode: e.currentTarget.value } : c,
                    ),
                  )
                }
                style={{ flex: 1, minWidth: 80 }}
              />
              <NumberInput
                id={`rubric-preset-edit-cat-marks-${preset.id}-${index}`}
                label={tRubrics('maxMarks')}
                value={cat.defaultMarks}
                onChange={(value) =>
                  setCategories((prev) =>
                    prev.map((c) =>
                      c.key === cat.key
                        ? {
                            ...c,
                            defaultMarks: typeof value === 'number' ? value : Number(value) || 0,
                          }
                        : c,
                    ),
                  )
                }
                min={0}
                style={{ width: 120 }}
              />
              <ActionIcon
                id={`rubric-preset-edit-cat-remove-${preset.id}-${index}`}
                variant="subtle"
                color="red"
                disabled={categories.length <= 1}
                onClick={() => setCategories((prev) => prev.filter((c) => c.key !== cat.key))}
                aria-label={tCommon('remove')}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Group justify="space-between">
            <Button
              id={`rubric-preset-edit-add-${preset.id}`}
              variant="light"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => setCategories((prev) => [...prev, emptyCategory(prev.length)])}
            >
              {tRubrics('addCategory')}
            </Button>
            <Text size="sm" c="dimmed">
              {tRubrics('totalMarks')}: {totalMarks}
            </Text>
          </Group>
        </Stack>
      )}
    </Stack>
  );
}

export function IntegrationsTabContent() {
  const tSettings = useTranslations('settings');
  const tGoogle = useTranslations('googleClassroom');
  const tRubrics = useTranslations('rubrics');
  const tCommon = useTranslations('common');
  const colors = useThemeColors();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { data: settings, isLoading: settingsLoading, error: settingsError } =
    useGoogleWorkspaceSettings();
  const autoSuggest = useAutoSuggestGoogleMappings();
  const createMapping = useCreateGoogleMapping();
  const [suggestions, setSuggestions] = useState<GoogleMappingSuggestion[]>([]);

  const { data: presets, isLoading: presetsLoading, error: presetsError } = useRubricPresets();
  const createPreset = useCreateRubricPreset();
  const [presetName, setPresetName] = useState('');
  const [categories, setCategories] = useState<CategoryDraft[]>([emptyCategory(0)]);

  const featureEnabled = settings?.isFeatureEnabled ?? false;

  useEffect(() => {
    if (!searchParams) return;
    const connected = searchParams.get('connected');
    const err = searchParams.get('error');
    if (!connected && !err) return;

    if (connected === '1') {
      notifications.show({
        title: tCommon('success'),
        message: tGoogle('connectedAs', {
          email: settings?.connectedEmail ?? 'Google',
        }),
        color: colors.success,
      });
    }
    if (err) {
      notifications.show({
        title: tCommon('error'),
        message: err,
        color: colors.error,
      });
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('connected');
    params.delete('error');
    const qs = params.toString();
    const path = pathname ?? '/';
    router.replace(qs ? `${path}?${qs}` : path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleAutoSuggest = () => {
    autoSuggest.mutate(undefined, {
      onSuccess: (data) => {
        setSuggestions(data ?? []);
        if (!data?.length) {
          notifications.show({
            title: tCommon('success'),
            message: tGoogle('notMapped'),
            color: 'blue',
          });
        }
      },
    });
  };

  const acceptSuggestion = (s: GoogleMappingSuggestion) => {
    createMapping.mutate(
      {
        classSectionId: s.classSectionId,
        subjectId: s.subjectId,
        googleCourseId: s.googleCourseId,
        googleCourseName: s.googleCourseName,
        googleCourseSection: s.googleCourseSection ?? undefined,
      },
      {
        onSuccess: () => {
          setSuggestions((prev) =>
            prev.filter(
              (x) =>
                !(
                  x.classSectionId === s.classSectionId &&
                  x.subjectId === s.subjectId &&
                  x.googleCourseId === s.googleCourseId
                ),
            ),
          );
        },
      },
    );
  };

  const handleCreatePreset = () => {
    const cats: CreateRubricPresetCategoryInput[] = categories
      .filter((c) => c.categoryName.trim())
      .map((c, index) => ({
        categoryName: c.categoryName.trim(),
        categoryCode: c.categoryCode.trim() || undefined,
        defaultMarks: Number(c.defaultMarks) || 0,
        sortOrder: index,
      }));

    if (!presetName.trim() || cats.length === 0) return;

    createPreset.mutate(
      {
        presetName: presetName.trim(),
        categories: cats,
      },
      {
        onSuccess: () => {
          setPresetName('');
          setCategories([emptyCategory(0)]);
        },
      },
    );
  };

  return (
    <Stack gap="lg" id="settings-integrations-panel">
      <Text c="dimmed" size="sm">
        {tSettings('integrationsDescription')}
      </Text>

      <Accordion
        multiple
        defaultValue={['google-classroom', 'rubrics']}
        variant="separated"
        id="settings-integrations-accordion"
      >
        <Accordion.Item value="google-classroom">
          <Accordion.Control id="settings-integrations-google-classroom-control">
            <Stack gap={2}>
              <Text fw={600}>{tSettings('integrationsGoogleClassroom')}</Text>
              <Text size="sm" c="dimmed">
                {tSettings('integrationsGoogleClassroomDescription')}
              </Text>
            </Stack>
          </Accordion.Control>
          <Accordion.Panel>
            {settingsLoading ? (
              <Stack gap="md">
                <Skeleton height={56} />
                <Skeleton height={120} />
              </Stack>
            ) : settingsError ? (
              <Alert color="red" title={tCommon('error')}>
                {settingsError.message}
              </Alert>
            ) : (
              <Stack gap="md">
                <Paper p="md" withBorder radius="md">
                  <FeatureToggle />
                </Paper>

                {featureEnabled && (
                  <>
                    <ConnectionCard />

                    <Group justify="space-between" wrap="wrap">
                      <Title order={5}>{tGoogle('courseMappings')}</Title>
                      <Button
                        id="google-classroom-auto-suggest"
                        variant="light"
                        size="sm"
                        onClick={handleAutoSuggest}
                        loading={autoSuggest.isPending}
                        disabled={!settings?.isConnected}
                      >
                        {tGoogle('autoSuggest')}
                      </Button>
                    </Group>

                    {suggestions.length > 0 && (
                      <Paper p="md" withBorder radius="md">
                        <Stack gap="sm">
                          <Text fw={500}>{tGoogle('autoSuggest')}</Text>
                          {suggestions.map((s) => (
                            <Group
                              key={`${s.classSectionId}-${s.subjectId}-${s.googleCourseId}`}
                              justify="space-between"
                              wrap="wrap"
                            >
                              <Text size="sm">
                                {s.classSectionLabel} · {s.subjectName} → {s.googleCourseName}
                                {s.googleCourseSection ? ` (${s.googleCourseSection})` : ''}{' '}
                                ({Math.round(s.confidence * 100)}%)
                              </Text>
                              <Button
                                id={`google-suggest-accept-${s.googleCourseId}`}
                                size="xs"
                                onClick={() => acceptSuggestion(s)}
                                loading={createMapping.isPending}
                              >
                                {tGoogle('addMapping')}
                              </Button>
                            </Group>
                          ))}
                        </Stack>
                      </Paper>
                    )}

                    <CourseMappingTable />
                  </>
                )}
              </Stack>
            )}
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="rubrics">
          <Accordion.Control id="settings-integrations-rubrics-control">
            <Stack gap={2}>
              <Text fw={600}>{tSettings('integrationsRubrics')}</Text>
              <Text size="sm" c="dimmed">
                {tSettings('integrationsRubricsDescription')}
              </Text>
            </Stack>
          </Accordion.Control>
          <Accordion.Panel>
            {presetsLoading ? (
              <Skeleton height={160} />
            ) : presetsError ? (
              <Alert color="red" title={tCommon('error')}>
                {presetsError.message}
              </Alert>
            ) : (
              <Stack gap="md">
                <Paper p="md" withBorder radius="md">
                  <Stack gap="md">
                    <Title order={5}>{tRubrics('title')}</Title>
                    <Text size="sm" c="dimmed">
                      {tRubrics('marksFlexibleHint')}
                    </Text>
                    {(presets ?? []).length === 0 ? (
                      <Text c="dimmed" size="sm">
                        {tRubrics('noRubric')}
                      </Text>
                    ) : (
                      (presets ?? []).map((preset, index) => (
                        <Stack key={preset.id} gap="xs">
                          {index > 0 && <Divider />}
                          <EditablePresetCard preset={preset} />
                        </Stack>
                      ))
                    )}
                  </Stack>
                </Paper>

                <Paper p="md" withBorder radius="md">
                  <Stack gap="md">
                    <Title order={5}>{tRubrics('createPreset')}</Title>
                    <TextInput
                      id="rubric-preset-name"
                      label={tRubrics('presetName')}
                      value={presetName}
                      onChange={(e) => setPresetName(e.currentTarget.value)}
                    />
                    {categories.map((cat, index) => (
                      <Group key={cat.key} align="flex-end" wrap="wrap" gap="sm">
                        <TextInput
                          id={`rubric-preset-cat-name-${index}`}
                          label={tRubrics('categoryName')}
                          value={cat.categoryName}
                          onChange={(e) =>
                            setCategories((prev) =>
                              prev.map((c) =>
                                c.key === cat.key
                                  ? { ...c, categoryName: e.currentTarget.value }
                                  : c,
                              ),
                            )
                          }
                          style={{ flex: 2, minWidth: 160 }}
                        />
                        <TextInput
                          id={`rubric-preset-cat-code-${index}`}
                          label={tRubrics('categoryCode')}
                          value={cat.categoryCode}
                          onChange={(e) =>
                            setCategories((prev) =>
                              prev.map((c) =>
                                c.key === cat.key
                                  ? { ...c, categoryCode: e.currentTarget.value }
                                  : c,
                              ),
                            )
                          }
                          style={{ flex: 1, minWidth: 80 }}
                        />
                        <NumberInput
                          id={`rubric-preset-cat-marks-${index}`}
                          label={tRubrics('maxMarks')}
                          value={cat.defaultMarks}
                          onChange={(value) =>
                            setCategories((prev) =>
                              prev.map((c) =>
                                c.key === cat.key
                                  ? {
                                      ...c,
                                      defaultMarks:
                                        typeof value === 'number' ? value : Number(value) || 0,
                                    }
                                  : c,
                              ),
                            )
                          }
                          min={0}
                          style={{ width: 120 }}
                        />
                        <ActionIcon
                          id={`rubric-preset-cat-remove-${index}`}
                          variant="subtle"
                          color="red"
                          disabled={categories.length <= 1}
                          onClick={() =>
                            setCategories((prev) => prev.filter((c) => c.key !== cat.key))
                          }
                          aria-label={tCommon('remove')}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    ))}
                    <Group justify="space-between">
                      <Button
                        id="rubric-preset-add-category"
                        variant="light"
                        leftSection={<IconPlus size={16} />}
                        onClick={() =>
                          setCategories((prev) => [...prev, emptyCategory(prev.length)])
                        }
                      >
                        {tRubrics('addCategory')}
                      </Button>
                      <Button
                        id="rubric-preset-create"
                        onClick={handleCreatePreset}
                        loading={createPreset.isPending}
                        disabled={!presetName.trim() || createPreset.isPending}
                      >
                        {tRubrics('createPreset')}
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              </Stack>
            )}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
