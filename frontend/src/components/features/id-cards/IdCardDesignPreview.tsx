'use client';

import { useTranslations } from 'next-intl';
import {
  Alert,
  Box,
  Collapse,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useIdCardDesignPreview } from '@/hooks/useIdCards';
import type { IdCardDesignVariant, IdCardPersonType } from '@/types/id-cards';
import { ID_CARD_DESIGN_VARIANTS } from '@/components/features/id-cards/IdCardDesignVariantToggle';

type Props = {
  variant: IdCardDesignVariant;
  onVariantChange: (v: IdCardDesignVariant) => void;
  personType?: IdCardPersonType;
  personId?: string;
};

export function IdCardDesignPreview({
  variant,
  onVariantChange,
  personType = 'student',
  personId,
}: Props) {
  const t = useTranslations('idCards');
  const [previewOpened, { toggle: togglePreview }] = useDisclosure(false);
  const { data: html, isLoading, error, isFetching } = useIdCardDesignPreview(
    variant,
    personType,
    personId,
    previewOpened,
  );

  const segmentedData = ID_CARD_DESIGN_VARIANTS.map((v) => ({
    value: v,
    label: t(`design.${v}`),
  }));

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {t('design.label')}
        </Text>
        <Text size="xs" c="dimmed">
          {t('design.hint')}
        </Text>
        <SegmentedControl
          id="id-cards-design-variant"
          value={variant}
          onChange={(v) => onVariantChange(v as IdCardDesignVariant)}
          data={segmentedData}
        />
      </Stack>

      <Stack gap={6}>
        <UnstyledButton onClick={togglePreview} id="id-cards-design-preview-toggle">
          <Group gap={6} wrap="nowrap">
            {previewOpened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <Text size="sm" fw={500} c="var(--mantine-color-anchor)">
              {t('preview')}
            </Text>
          </Group>
        </UnstyledButton>

        <Collapse in={previewOpened}>
          <Paper withBorder p="md" radius="md" bg="gray.0">
            {isLoading || isFetching ? (
              <Box py="xl" style={{ display: 'flex', justifyContent: 'center' }}>
                <Loader size="sm" />
              </Box>
            ) : error ? (
              <Alert color="red">{error.message}</Alert>
            ) : html ? (
              <Box
                component="iframe"
                title={t('design.previewTitle')}
                srcDoc={html}
                style={{
                  width: '100%',
                  minHeight: 420,
                  border: 'none',
                  borderRadius: 'var(--mantine-radius-md)',
                  background: 'transparent',
                }}
                sandbox="allow-same-origin"
              />
            ) : (
              <Text c="dimmed" size="sm">
                {t('design.emptyPreview')}
              </Text>
            )}
          </Paper>
        </Collapse>
      </Stack>
    </Stack>
  );
}
