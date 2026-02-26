'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Group, Select, Stack, Alert, Paper } from '@mantine/core';
import { useClassSections } from '@/hooks/useClassSections';
import { useBehavioralMatrix } from '@/hooks/useBehavioral';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { BehavioralMatrix } from '@/components/features/behavioral/BehavioralMatrix';

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
 * Behavioral matrix: class section + month filters, then matrix grid.
 * Used on the main Behavioral page (Matrix tab) and on /behavioral/assess.
 */
export function BehavioralAssessContent() {
  const t = useTranslations('behavioral');
  const colors = useThemeColors();
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(defaultMonth);

  const classSectionsQuery = useClassSections({ limit: 100, minimal: true });
  const matrixQuery = useBehavioralMatrix(classSectionId, month);

  const classSectionOptions =
    (classSectionsQuery.data?.data ?? [])
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
        <Group align="flex-end" wrap="wrap" gap="md">
          <Select
            label={t('classSection')}
            placeholder={t('selectClassSection')}
            data={classSectionOptions}
            value={classSectionId}
            onChange={(v) => setClassSectionId(v)}
            clearable
            style={{ minWidth: 200 }}
          />
          <Select
            label={t('month')}
            data={monthOptions}
            value={month}
            onChange={(v) => setMonth(v ?? defaultMonth)}
            style={{ minWidth: 140 }}
          />
        </Group>
      </Paper>

      {!classSectionId ? (
        <Alert color={colors.primary}>
          {t('selectSectionAndMonth')}
        </Alert>
      ) : (
        <BehavioralMatrix
          data={matrixQuery.data ?? null}
          isLoading={matrixQuery.isLoading}
          onSaved={() => matrixQuery.refetch()}
        />
      )}
    </Stack>
  );
}
