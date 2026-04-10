'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Title,
  Text,
  Select,
  Stack,
  Skeleton,
  Paper,
  Group,
  Alert,
  Anchor,
} from '@mantine/core';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useClassSections } from '@/hooks/useClassSections';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { ClassTimetableContent } from '@/components/features/timetable/ClassTimetableContent';

export default function TimetablePage() {
  const t = useTranslations('timetable');
  const searchParams = useSearchParams();
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const colors = useThemeColors();
  const {
    data: activeYearResponse,
    isLoading: isLoadingActiveYear,
    error: activeYearError,
  } = useActiveAcademicYear();
  const activeYear = activeYearResponse?.data ?? null;
  const activeYearId = activeYear?.id;
  const {
    data: classSectionsData,
    isLoading: isLoadingClassSections,
    error: classSectionsError,
  } = useClassSections(
    activeYearId
      ? {
          isActive: true,
          minimal: true,
          academicYearId: activeYearId,
        }
      : {
          isActive: true,
          minimal: true,
          enabled: false,
        },
  );

  const classSections = classSectionsData?.data || [];

  // Allow deep-linking to a pre-selected class section (e.g. from conflict window)
  useEffect(() => {
    const classSectionIdFromQuery = searchParams.get('classSectionId');
    if (!classSectionIdFromQuery) return;

    // Only set if it exists in the loaded options; avoids selecting stale IDs.
    const exists = classSections.some((cs) => cs.id === classSectionIdFromQuery);
    if (exists) {
      setSelectedClassSectionId(classSectionIdFromQuery);
    }
  }, [searchParams, classSections]);

  const classSectionOptions = classSections
    .sort((a, b) => {
      // Sort by class sort order first, then by section sort order
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) {
        return classOrderA - classOrderB;
      }
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    })
    .map((cs) => ({
      value: cs.id,
      label: `${cs.className || cs.classDisplayName || t('unknown')} - ${cs.sectionName || t('unknown')}`,
    }));

  if (isLoadingActiveYear || isLoadingClassSections) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('title')}</Title>
        </div>
        <div
          style={{
            marginTop: '60px',
            paddingLeft: 'var(--mantine-spacing-md)',
            paddingRight: 'var(--mantine-spacing-md)',
            paddingTop: 'var(--mantine-spacing-sm)',
            paddingBottom: 'var(--mantine-spacing-xl)',
          }}
        >
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={200} />
          </Stack>
        </div>
      </>
    );
  }

  if (activeYearError || !activeYearId) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('title')}</Title>
        </div>
        <div
          style={{
            marginTop: '60px',
            paddingLeft: 'var(--mantine-spacing-md)',
            paddingRight: 'var(--mantine-spacing-md)',
            paddingTop: 'var(--mantine-spacing-sm)',
            paddingBottom: 'var(--mantine-spacing-xl)',
          }}
        >
          <Alert color={colors.warning} title={t('academicYear')}>
            <Text size="sm">
              {t('noActiveAcademicYearTimetableMessage')}{' '}
              <Anchor component={Link} href="/settings/academic-years">
                {t('settingsAcademicYears')}
              </Anchor>
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  if (classSectionsError) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('title')}</Title>
        </div>
        <div
          style={{
            marginTop: '60px',
            paddingLeft: 'var(--mantine-spacing-md)',
            paddingRight: 'var(--mantine-spacing-md)',
            paddingTop: 'var(--mantine-spacing-sm)',
            paddingBottom: 'var(--mantine-spacing-xl)',
          }}
        >
          <Alert color={colors.error} title={t('errorLoadingTimetable')}>
            <Text size="sm">{String(classSectionsError)}</Text>
          </Alert>
        </div>
      </>
    );
  }

  if (classSections.length === 0) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('title')}</Title>
        </div>
        <div
          style={{
            marginTop: '60px',
            paddingLeft: 'var(--mantine-spacing-md)',
            paddingRight: 'var(--mantine-spacing-md)',
            paddingTop: 'var(--mantine-spacing-sm)',
            paddingBottom: 'var(--mantine-spacing-xl)',
          }}
        >
          <Paper p="md" withBorder>
            <Text c="dimmed" ta="center">
              {t('noActiveClassSections')}
            </Text>
          </Paper>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{t('title')}</Title>
      </div>
      <div className="page-sub-title-bar" />
      <div
        style={{
          marginTop: '60px',
          paddingLeft: 'var(--mantine-spacing-md)',
          paddingRight: 'var(--mantine-spacing-md)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingBottom: 'var(--mantine-spacing-xl)',
        }}
      >
        <Stack gap="md">
          <Paper withBorder p="md">
            <Stack gap="md">
              {activeYear && (
                <Text size="sm" c="dimmed">
                  {t('activeAcademicYear')} <strong>{activeYear.name}</strong>
                </Text>
              )}
              <Select
                label={t('selectClassSection')}
                placeholder={t('chooseClassSection')}
                data={classSectionOptions}
                value={selectedClassSectionId}
                onChange={setSelectedClassSectionId}
                searchable
                clearable
              />
            </Stack>
          </Paper>

          {selectedClassSectionId ? (
            <ClassTimetableContent
              classSectionId={selectedClassSectionId}
              showHeaderActions={false}
            />
          ) : (
            <Alert color={colors.primary}>
              {t('selectClassSectionPrompt')}
            </Alert>
          )}
        </Stack>
      </div>
    </>
  );
}
