'use client';

import { Button, Group, Select, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { useRubricPresets } from '@/hooks/api/useRubrics';

interface PresetSelectorProps {
  onSelect: (presetId: string) => void;
  disabled?: boolean;
}

export function PresetSelector({ onSelect, disabled = false }: PresetSelectorProps) {
  const t = useTranslations('rubrics');
  const { data: presets, isLoading } = useRubricPresets();
  const list = presets ?? [];

  const ktacPreset = list.find(
    (p) => p.presetCode?.toUpperCase() === 'KTAC' || p.presetName.toUpperCase().includes('KTAC'),
  );

  const options = list.map((p) => ({
    value: p.id,
    label: p.presetName,
  }));

  return (
    <Stack gap="sm">
      <Group align="flex-end" wrap="wrap">
        <Select
          id="rubric-preset-select"
          label={t('presetName')}
          placeholder={t('presetName')}
          data={options}
          searchable
          clearable
          disabled={disabled || isLoading}
          onChange={(value) => {
            if (value) onSelect(value);
          }}
          style={{ flex: 1, minWidth: 200 }}
        />
        {ktacPreset && (
          <Button
            id="rubric-use-ktac"
            variant="light"
            disabled={disabled}
            onClick={() => onSelect(ktacPreset.id)}
          >
            {t('useKtac')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}
