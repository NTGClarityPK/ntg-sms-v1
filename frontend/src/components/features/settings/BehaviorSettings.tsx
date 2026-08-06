'use client';

import { Alert, Button, Checkbox, Group, Paper, Stack, Switch, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSystemSetting, useUpdateSystemSetting } from '@/hooks/useSystemSettings';
import {
  useBehavioralFrameworkConfig,
  useCloneFrameworkPreset,
  useCreateBlankFrameworkPreset,
  useFrameworkPresets,
  useUpdateBehavioralFrameworkConfig,
} from '@/hooks/useBehavioralFramework';
import { useTranslations } from 'next-intl';
import { DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE } from '@/constants/default-behavior-attributes';
import type {
  BehavioralActiveSystem,
  FrameworkPreset,
} from '@/types/behavioral-framework';
import { BehavioralSystemSelector } from './behavioral-framework/BehavioralSystemSelector';
import { FrameworkCustomizer } from './behavioral-framework/FrameworkCustomizer';
import { FrameworkPresetPicker } from './behavioral-framework/FrameworkPresetPicker';

interface BehavioralAssessmentValue {
  enabled: boolean;
  mandatory: boolean;
  attributes: string[];
}

const DEFAULT_VALUE: BehavioralAssessmentValue = {
  enabled: DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE.enabled,
  mandatory: DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE.mandatory,
  attributes: [...DEFAULT_BEHAVIOURAL_ASSESSMENT_VALUE.attributes],
};

const ONTARIO_PRESET_CODE = 'ontario_learning_skills';

export function BehaviorSettings({ showHeader = true }: { showHeader?: boolean }) {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');

  const settingQuery = useSystemSetting<BehavioralAssessmentValue>('behavioral_assessment');
  const updateMutation = useUpdateSystemSetting<BehavioralAssessmentValue>('behavioral_assessment');

  const configQuery = useBehavioralFrameworkConfig();
  const presetsQuery = useFrameworkPresets();
  const updateConfig = useUpdateBehavioralFrameworkConfig();
  const clonePreset = useCloneFrameworkPreset();
  const createBlank = useCreateBlankFrameworkPreset();

  const [value, setValue] = useState<BehavioralAssessmentValue | null>(null);
  const [newAttr, setNewAttr] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<BehavioralActiveSystem>('star_based');
  const [draftPreset, setDraftPreset] = useState<FrameworkPreset | null>(null);

  const activeSystem: BehavioralActiveSystem =
    configQuery.data?.activeSystem ?? 'star_based';

  useEffect(() => {
    const remote = settingQuery.data?.data?.value;
    if (!value && remote && typeof remote === 'object') {
      setValue({
        enabled: remote.enabled ?? DEFAULT_VALUE.enabled,
        mandatory: remote.mandatory ?? DEFAULT_VALUE.mandatory,
        attributes: Array.isArray(remote.attributes) ? remote.attributes : DEFAULT_VALUE.attributes,
      });
      return;
    }
    if (!value && !remote) {
      setValue(DEFAULT_VALUE);
    }
  }, [settingQuery.data?.data?.value, value]);

  useEffect(() => {
    if (configQuery.data?.activeSystem) {
      setSelectedSystem(configQuery.data.activeSystem);
    }
  }, [configQuery.data?.activeSystem]);

  useEffect(() => {
    // Prefer live config preset once switched; keep draft until then.
    if (configQuery.data?.frameworkPreset && configQuery.data.activeSystem === 'framework_based') {
      setDraftPreset(configQuery.data.frameworkPreset);
    }
  }, [configQuery.data?.frameworkPreset, configQuery.data?.activeSystem]);

  const attrs = useMemo(
    () => (value?.attributes ?? []).map((a) => a.trim()).filter((a) => a.length > 0),
    [value?.attributes],
  );

  const branchPresets = useMemo(
    () => (presetsQuery.data ?? []).filter((p) => !p.isGlobal),
    [presetsQuery.data],
  );

  const activeOrDraftPreset: FrameworkPreset | null = useMemo(() => {
    if (draftPreset && !draftPreset.isGlobal) return draftPreset;
    if (configQuery.data?.frameworkPreset && !configQuery.data.frameworkPreset.isGlobal) {
      return configQuery.data.frameworkPreset;
    }
    const id = configQuery.data?.frameworkPresetId;
    if (id) {
      return branchPresets.find((p) => p.id === id) ?? null;
    }
    return branchPresets[0] ?? null;
  }, [branchPresets, configQuery.data?.frameworkPreset, configQuery.data?.frameworkPresetId, draftPreset]);

  const showFrameworkSetup =
    selectedSystem === 'framework_based' || activeSystem === 'framework_based';
  const showStarAttributes = activeSystem === 'star_based';
  const needsPresetBeforeSwitch =
    selectedSystem === 'framework_based' && !activeOrDraftPreset;

  const addAttr = () => {
    if (!value) return;
    const next = newAttr.trim();
    if (!next) return;
    if (attrs.includes(next)) return;
    setValue((prev) => ({
      ...(prev ?? DEFAULT_VALUE),
      attributes: [...attrs, next],
    }));
    setNewAttr('');
  };

  const removeAttr = (name: string) => {
    setValue((prev) => ({
      ...(prev ?? DEFAULT_VALUE),
      attributes: attrs.filter((a) => a !== name),
    }));
  };

  const onSave = async () => {
    if (!value) return;
    try {
      await updateMutation.mutateAsync({ ...value, attributes: attrs });
      notifications.show({
        title: tCommon('success'),
        message: tSettings('behaviorSaved'),
        color: notifyColors.success,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('errors.generic');
      notifications.show({ title: tCommon('error'), message, color: notifyColors.error });
    }
  };

  const performSwitch = async (system: BehavioralActiveSystem, presetId?: string) => {
    await updateConfig.mutateAsync({
      activeSystem: system,
      ...(system === 'framework_based' && presetId
        ? { frameworkPresetId: presetId }
        : {}),
    });
    setSelectedSystem(system);
  };

  const confirmAndSwitch = (
    system: BehavioralActiveSystem,
    presetId?: string,
    presetOverride?: FrameworkPreset | null,
  ) => {
    if (system === 'framework_based') {
      if (!presetId) {
        notifications.show({
          title: tCommon('error'),
          message: tSettings('behaviorFrameworkNeedPreset'),
          color: notifyColors.error,
        });
        return;
      }
      const preset =
        presetOverride ??
        (draftPreset && draftPreset.id === presetId ? draftPreset : null) ??
        branchPresets.find((p) => p.id === presetId) ??
        activeOrDraftPreset;
      if (!preset || (preset.categories.length ?? 0) === 0) {
        notifications.show({
          title: tCommon('error'),
          message: tSettings('behaviorFrameworkNeedCategory'),
          color: notifyColors.error,
        });
        return;
      }

      modals.openConfirmModal({
        title: tSettings('behaviorFrameworkSwitchConfirmTitle'),
        centered: true,
        children: (
          <Text size="sm">{tSettings('behaviorFrameworkSwitchToFrameworkBody')}</Text>
        ),
        labels: {
          confirm: tSettings('behaviorFrameworkSwitchAnyway'),
          cancel: tCommon('cancel'),
        },
        confirmProps: { id: 'behavior-framework-switch-confirm' },
        cancelProps: { id: 'behavior-framework-switch-cancel' },
        onConfirm: () => {
          void performSwitch('framework_based', presetId);
        },
        onCancel: () => {
          setSelectedSystem(activeSystem);
        },
      });
      return;
    }

    modals.openConfirmModal({
      title: tSettings('behaviorFrameworkSwitchConfirmTitle'),
      centered: true,
      children: <Text size="sm">{tSettings('behaviorFrameworkSwitchToStarBody')}</Text>,
      labels: {
        confirm: tSettings('behaviorFrameworkSwitchAnyway'),
        cancel: tCommon('cancel'),
      },
      confirmProps: { id: 'behavior-framework-switch-confirm' },
      cancelProps: { id: 'behavior-framework-switch-cancel' },
      onConfirm: () => {
        void performSwitch('star_based');
      },
      onCancel: () => {
        setSelectedSystem(activeSystem);
      },
    });
  };

  const onRequestSwitch = () => {
    if (selectedSystem === activeSystem) return;
    if (selectedSystem === 'framework_based') {
      confirmAndSwitch('framework_based', activeOrDraftPreset?.id, activeOrDraftPreset);
      return;
    }
    confirmAndSwitch('star_based');
  };

  const onSelectSystem = (system: BehavioralActiveSystem) => {
    setSelectedSystem(system);
    if (system === activeSystem) return;
    if (system === 'framework_based' && !activeOrDraftPreset) {
      // Show preset picker; switch happens after clone/create.
      return;
    }
    confirmAndSwitch(
      system,
      system === 'framework_based' ? activeOrDraftPreset?.id : undefined,
      system === 'framework_based' ? activeOrDraftPreset : null,
    );
  };

  const onUseOntario = async () => {
    const preset = await clonePreset.mutateAsync(ONTARIO_PRESET_CODE);
    setDraftPreset(preset);
    setSelectedSystem('framework_based');
    // Cloning is an explicit choice to use framework — activate immediately after confirm.
    confirmAndSwitch('framework_based', preset.id, preset);
  };

  const onCreateBlank = async () => {
    const preset = await createBlank.mutateAsync({
      presetName: tSettings('behaviorFrameworkBlankDefaultName'),
      commentsRequired: false,
    });
    setDraftPreset(preset);
    setSelectedSystem('framework_based');
    // Blank frameworks need a category before switch; keep picker/customizer visible.
    if ((preset.categories?.length ?? 0) > 0) {
      confirmAndSwitch('framework_based', preset.id, preset);
    }
  };

  if (settingQuery.error || configQuery.error) {
    return (
      <Alert color={colors.error} title={tSettings('behaviorLoadError')}>
        <Text size="sm">{tSettings('genericPleaseTryAgain')}</Text>
      </Alert>
    );
  }

  if (!value || configQuery.isLoading) {
    return (
      <Paper withBorder p="md">
        <Group justify="center" py="md">
          <Text size="sm" c="dimmed">
            {tSettings('behaviorLoading')}
          </Text>
        </Group>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {showHeader && (
        <Stack gap={4}>
          <Text size="lg" fw={600}>
            {tSettings('generalBehaviorTitle')}
          </Text>
          <Text size="sm" c="dimmed">
            {tSettings('generalBehaviorDescription')}
          </Text>
        </Stack>
      )}

      <Paper withBorder p="md">
        <Stack gap="md">
          {!showHeader && <Text fw={600}>{tSettings('behaviorTitle')}</Text>}

          <Switch
            id="behavior-settings-enabled"
            label={tSettings('behaviorEnableSwitch')}
            checked={value.enabled}
            onChange={() =>
              setValue((prev) => ({
                ...(prev ?? DEFAULT_VALUE),
                enabled: !(prev ?? DEFAULT_VALUE).enabled,
              }))
            }
          />

          <Checkbox
            id="behavior-settings-mandatory"
            label={tSettings('behaviorMandatory')}
            checked={value.mandatory}
            disabled={!value.enabled}
            onChange={() =>
              setValue((prev) => ({
                ...(prev ?? DEFAULT_VALUE),
                mandatory: !(prev ?? DEFAULT_VALUE).mandatory,
              }))
            }
          />

          <Group justify="flex-end">
            <Button
              id="behavior-settings-save"
              variant="light"
              onClick={onSave}
              loading={!settingQuery.isLoading && updateMutation.isPending}
              disabled={settingQuery.isLoading}
            >
              {tCommon('save')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <BehavioralSystemSelector
        activeSystem={activeSystem}
        selectedSystem={selectedSystem}
        onSelectSystem={onSelectSystem}
        onRequestSwitch={onRequestSwitch}
        switchDisabled={
          selectedSystem === 'framework_based' &&
          (!activeOrDraftPreset || (activeOrDraftPreset.categories.length ?? 0) === 0)
        }
        switchLoading={updateConfig.isPending}
      />

      {showStarAttributes && (
        <Paper withBorder p="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {tSettings('behaviorAttributesHint')}
            </Text>

            <Group align="flex-end">
              <TextInput
                id="behavior-settings-attribute-input"
                label={tSettings('behaviorAddAttributeLabel')}
                placeholder={tSettings('behaviorAddAttributePlaceholder')}
                value={newAttr}
                onChange={(e) => setNewAttr(e.currentTarget.value)}
              />
              <Button id="behavior-settings-add-attribute" variant="light" onClick={addAttr}>
                {tCommon('add')}
              </Button>
            </Group>

            <Stack gap="xs">
              {attrs.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {tSettings('behaviorNoAttributes')}
                </Text>
              ) : (
                attrs.map((a) => (
                  <Group key={a} justify="space-between">
                    <Text size="sm">{a}</Text>
                    <Button
                      id={`behavior-settings-remove-${a.replace(/\s+/g, '-').toLowerCase()}`}
                      variant="light"
                      onClick={() => removeAttr(a)}
                    >
                      {tCommon('remove')}
                    </Button>
                  </Group>
                ))
              )}
            </Stack>
          </Stack>
        </Paper>
      )}

      {showFrameworkSetup && (
        <>
          {(needsPresetBeforeSwitch || !activeOrDraftPreset) && (
            <FrameworkPresetPicker
              onUseOntario={() => {
                void onUseOntario();
              }}
              onCreateBlank={() => {
                void onCreateBlank();
              }}
              ontarioLoading={clonePreset.isPending}
              blankLoading={createBlank.isPending}
            />
          )}

          {activeOrDraftPreset && !activeOrDraftPreset.isGlobal && (
            <FrameworkCustomizer preset={activeOrDraftPreset} />
          )}

          {presetsQuery.isLoading && !activeOrDraftPreset && (
            <Text size="sm" c="dimmed">
              {tSettings('behaviorFrameworkPresetsLoading')}
            </Text>
          )}
        </>
      )}
    </Stack>
  );
}
