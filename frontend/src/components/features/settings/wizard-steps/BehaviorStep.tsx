'use client';

import { ActionIcon, Button, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES } from '@/constants/default-behavior-attributes';
import type { BehaviorData } from './types';
import { useTranslations } from 'next-intl';

interface BehaviorStepProps {
  data: BehaviorData | null;
  onChange: (data: BehaviorData) => void;
  onNext: () => void;
  onBack: () => void;
}

function mergeBehaviorForm(data: BehaviorData | null): BehaviorData {
  const base: BehaviorData = {
    enabled: false,
    mandatory: false,
    attributes: [...DEFAULT_BEHAVIOURAL_ATTRIBUTE_NAMES],
  };
  if (!data) return base;
  const attrs = (data.attributes ?? []).map((a) => a.trim()).filter((a) => a.length > 0);
  return {
    enabled: data.enabled,
    mandatory: data.mandatory,
    attributes: attrs.length > 0 ? [...new Set(attrs)] : [],
  };
}

export function BehaviorStep({ data, onChange, onNext, onBack }: BehaviorStepProps) {
  const colors = useThemeColors();
  const tSettings = useTranslations('settings');
  const tCommon = useTranslations('common');
  const [newAttribute, setNewAttribute] = useState('');

  const formData = useMemo(() => mergeBehaviorForm(data), [data]);

  const pushChange = (next: BehaviorData) => {
    onChange(next);
  };

  const handleToggleEnabled = (checked: boolean) => {
    pushChange({
      ...formData,
      enabled: checked,
    });
  };

  const handleToggleMandatory = (checked: boolean) => {
    pushChange({
      ...formData,
      mandatory: checked,
    });
  };

  const handleAddAttribute = () => {
    const trimmed = newAttribute.trim();
    if (!trimmed || formData.attributes.includes(trimmed)) return;
    pushChange({
      ...formData,
      attributes: [...formData.attributes, trimmed],
    });
    setNewAttribute('');
  };

  const handleRemoveAttribute = (attribute: string) => {
    pushChange({
      ...formData,
      attributes: formData.attributes.filter((a) => a !== attribute),
    });
  };

  const handleNext = () => {
    pushChange(formData);
    onNext();
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        {tSettings('setupWizardBehaviorTitle')}
      </Text>
      <Text size="sm" c="dimmed">
        {tSettings('setupWizardBehaviorDescription')}
      </Text>
      <Text size="sm" c="dimmed">
        {tSettings('setupWizardBehaviorDefaultsHint')}
      </Text>

      <Stack gap="lg" mt="md">
        <Checkbox
          id="behavior-step-enabled"
          label={tSettings('setupWizardBehaviorEnableLabel')}
          checked={formData.enabled}
          onChange={(e) => handleToggleEnabled(e.currentTarget.checked)}
        />

        <Checkbox
          id="behavior-step-mandatory"
          label={tSettings('setupWizardBehaviorMandatoryLabel')}
          checked={formData.mandatory}
          disabled={!formData.enabled}
          onChange={(e) => handleToggleMandatory(e.currentTarget.checked)}
        />

        <div>
          <Text size="sm" fw={500} mb="xs">
            {tSettings('setupWizardBehaviorAttributesTitle')}
          </Text>
          <Group gap="xs" mb="xs" wrap="nowrap" align="flex-end">
            <TextInput
              id="behavior-step-attribute-input"
              placeholder={tSettings('setupWizardBehaviorAttributePlaceholder')}
              value={newAttribute}
              onChange={(e) => setNewAttribute(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAttribute();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button id="behavior-step-add-attribute" onClick={handleAddAttribute} size="sm">
              {tCommon('add')}
            </Button>
          </Group>
          {formData.attributes.length > 0 && (
            <Stack gap="xs">
              {formData.attributes.map((attr) => (
                <Group key={attr} justify="space-between" wrap="nowrap">
                  <Text size="sm">{attr}</Text>
                  <ActionIcon
                    id={`behavior-step-remove-${attr.replace(/\s+/g, '-').toLowerCase()}`}
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleRemoveAttribute(attr)}
                    aria-label={tCommon('remove')}
                  >
                    <IconX size={16} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          )}
        </div>
      </Stack>

      <Group justify="space-between" mt="xl">
        <Button id="behavior-step-back" variant="light" onClick={onBack}>
          {tCommon('back')}
        </Button>
        <Button id="behavior-step-next" onClick={handleNext} color={colors.primary}>
          {tCommon('next')}
        </Button>
      </Group>
    </Stack>
  );
}
