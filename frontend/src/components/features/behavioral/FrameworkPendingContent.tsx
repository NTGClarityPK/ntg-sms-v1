'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useClassSections } from '@/hooks/useClassSections';
import { useFrameworkClassReport } from '@/hooks/useBehavioralFramework';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

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
 * Framework pending: students in a class section without a rating for the month.
 */
export function FrameworkPendingContent() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const t = useTranslations('behavioral');
  const colors = useThemeColors();
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(defaultMonth);

  const classSectionsQuery = useClassSections({ limit: 100, minimal: true });
  const reportQuery = useFrameworkClassReport(classSectionId, month);

  const classSectionOptions = (classSectionsQuery.data?.data ?? [])
    .sort((a, b) => {
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;
      return (a.sectionSortOrder ?? 999) - (b.sectionSortOrder ?? 999);
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.className ?? ''} ${cs.sectionName ?? ''}`.trim() || cs.id,
    }));

  const pending = useMemo(
    () => (reportQuery.data?.students ?? []).filter((s) => !s.rating),
    [reportQuery.data?.students],
  );

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        {isMobile ? (
          <Stack gap="md">
            <Select
              id="behavior-framework-pending-section"
              label={t('classSection')}
              placeholder={t('selectClassSection')}
              data={classSectionOptions}
              value={classSectionId}
              onChange={(v) => setClassSectionId(v)}
              clearable
            />
            <Select
              id="behavior-framework-pending-month"
              label={t('month')}
              data={monthOptions}
              value={month}
              onChange={(v) => setMonth(v ?? defaultMonth)}
            />
          </Stack>
        ) : (
          <Group align="flex-end" wrap="wrap" gap="md">
            <Select
              id="behavior-framework-pending-section"
              label={t('classSection')}
              placeholder={t('selectClassSection')}
              data={classSectionOptions}
              value={classSectionId}
              onChange={(v) => setClassSectionId(v)}
              clearable
              style={{ minWidth: 200 }}
            />
            <Select
              id="behavior-framework-pending-month"
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
        <Alert color={colors.primary}>{t('frameworkPendingSelectSection')}</Alert>
      ) : (
        <Paper withBorder p="md">
          <Text size="sm" fw={500} mb="xs">
            {t('frameworkPendingDescription')}
          </Text>
          {reportQuery.isLoading ? (
            <Skeleton height={80} radius="sm" />
          ) : pending.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('frameworkNoPending')}
            </Text>
          ) : (
            <Stack gap="xs">
              {pending.slice(0, 50).map((s) => (
                <Text key={s.studentId} size="sm">
                  {`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.schoolStudentId}
                </Text>
              ))}
              {pending.length > 50 ? (
                <Text size="sm" c="dimmed">
                  {t('moreCount', { count: pending.length - 50 })}
                </Text>
              ) : null}
            </Stack>
          )}
        </Paper>
      )}
    </Stack>
  );
}
