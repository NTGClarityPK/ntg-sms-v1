'use client';

import { useTranslations } from 'next-intl';
import { SegmentedControl, Stack, Text } from '@mantine/core';
import type { IdCardDesignVariant } from '@/types/id-cards';

export const ID_CARD_DESIGN_VARIANTS: IdCardDesignVariant[] = ['classic', 'minimal'];

type Props = {
  value: IdCardDesignVariant;
  onChange: (value: IdCardDesignVariant) => void;
  id?: string;
  showHint?: boolean;
};

export function IdCardDesignVariantToggle({ value, onChange, id = 'id-cards-design-variant', showHint = true }: Props) {
  const t = useTranslations('idCards');

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {t('design.label')}
      </Text>
      {showHint && (
        <Text size="xs" c="dimmed">
          {t('design.hint')}
        </Text>
      )}
      <SegmentedControl
        id={id}
        value={value}
        onChange={(v) => onChange(v as IdCardDesignVariant)}
        data={ID_CARD_DESIGN_VARIANTS.map((v) => ({
          value: v,
          label: t(`design.${v}`),
        }))}
      />
    </Stack>
  );
}
