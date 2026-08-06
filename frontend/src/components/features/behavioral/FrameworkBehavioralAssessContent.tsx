'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Group, Paper, Select, Stack, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useClassSections } from '@/hooks/useClassSections';
import {
  useBehavioralFrameworkConfig,
  useFrameworkClassReport,
} from '@/hooks/useBehavioralFramework';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { FrameworkBehavioralMatrix } from './FrameworkBehavioralMatrix';

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -2; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

const monthOptions = getMonthOptions();
const defaultMonth = new Date().toISOString().slice(0, 7) + '-01';

/**
 * Framework matrix: class section + month filters, then category summary grid.
 */
export function FrameworkBehavioralAssessContent() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('behavioral');
  const colors = useThemeColors();
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(defaultMonth);

  const configQuery = useBehavioralFrameworkConfig();
  const classSectionsQuery = useClassSections({ limit: 100, minimal: true });
  const reportQuery = useFrameworkClassReport(classSectionId, month);

  const preset = configQuery.data?.frameworkPreset ?? null;

  const classSectionOptions = (classSectionsQuery.data?.data ?? [])
    .sort((a, b) => {
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        {isMobile ? (
          <Stack gap="md">
            <Select
              id="behavior-framework-assess-section"
              label={t('classSection')}
              placeholder={t('selectClassSection')}
              data={classSectionOptions}
              value={classSectionId}
              onChange={(v) => setClassSectionId(v)}
              clearable
            />
            <Select
              id="behavior-framework-assess-month"
              label={t('month')}
              data={monthOptions}
              value={month}
              onChange={(v) => setMonth(v ?? defaultMonth)}
            />
          </Stack>
        ) : (
          <Group align="flex-end" wrap="wrap" gap="md">
            <Select
              id="behavior-framework-assess-section"
              label={t('classSection')}
              placeholder={t('selectClassSection')}
              data={classSectionOptions}
              value={classSectionId}
              onChange={(v) => setClassSectionId(v)}
              clearable
              style={{ minWidth: 200 }}
            />
            <Select
              id="behavior-framework-assess-month"
              label={t('month')}
              data={monthOptions}
              value={month}
              onChange={(v) => setMonth(v ?? defaultMonth)}
              style={{ minWidth: 140 }}
            />
          </Group>
        )}
      </Paper>

      {!classSectionId ? (
        <Alert color={colors.primary}>{t('selectSectionAndMonth')}</Alert>
      ) : !preset ? (
        <Alert color="yellow">{t('frameworkNoPresetConfigured')}</Alert>
      ) : (
        <FrameworkBehavioralMatrix
          report={reportQuery.data ?? null}
          preset={preset}
          isLoading={reportQuery.isLoading || configQuery.isLoading}
          onSaved={() => {
            void reportQuery.refetch();
          }}
        />
      )}
    </Stack>
  );
}
