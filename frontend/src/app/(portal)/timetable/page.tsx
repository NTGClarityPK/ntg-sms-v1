'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useMyStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { ClassTimetableContent } from '@/components/features/timetable/ClassTimetableContent';

export default function TimetablePage() {
  const t = useTranslations('timetable');
  const { user } = useAuth();
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

  const isSuperAdmin =
    user?.roles?.some((r) => (r.roleName ?? '').toLowerCase() === 'super_admin') ?? false;
  /** Same roles as Sidebar `canManageTimetable` — sees every class-section in the dropdown. */
  const seesAllBranchClassSections =
    isSuperAdmin ||
    (user?.roles?.some((r) => {
      const n = (r.roleName ?? '').toLowerCase();
      return n === 'school_admin' || n === 'principal' || n === 'academic_coordinator';
    }) ??
      false);
  const isTeachingStaff =
    user?.roles?.some((r) => {
      const n = (r.roleName ?? '').toLowerCase();
      return n === 'class_teacher' || n === 'subject_teacher';
    }) ?? false;

  const scopeClassSectionsToTeachingStaff =
    isTeachingStaff && !seesAllBranchClassSections;

  const {
    data: myStaffPayload,
    isLoading: isLoadingMyStaff,
  } = useMyStaff();
  const myStaffRecord = myStaffPayload?.data ?? null;

  const classSectionsParams = useMemo(() => {
    if (!activeYearId) return null;
    const base = {
      isActive: true,
      minimal: true,
      academicYearId: activeYearId,
      page: 1,
      limit: 500,
    } as const;
    if (scopeClassSectionsToTeachingStaff && myStaffRecord?.id) {
      return {
        ...base,
        classTeacherId: myStaffRecord.id,
      };
    }
    if (scopeClassSectionsToTeachingStaff) {
      return null;
    }
    return base;
  }, [
    activeYearId,
    scopeClassSectionsToTeachingStaff,
    myStaffRecord?.id,
  ]);

  const classSectionsQueryEnabled =
    !!activeYearId && classSectionsParams !== null && (!scopeClassSectionsToTeachingStaff || !!myStaffRecord?.id);

  const {
    data: classSectionsData,
    isLoading: isLoadingClassSections,
    error: classSectionsError,
  } = useClassSections(
    classSectionsParams
      ? { ...classSectionsParams, enabled: classSectionsQueryEnabled }
      : { isActive: true, minimal: true, enabled: false },
  );

  const classSections = classSectionsData?.data || [];

  // Allow deep-linking to a pre-selected class section (e.g. from conflict window)
  useEffect(() => {
    const classSectionIdFromQuery = searchParams?.get('classSectionId');
    if (!classSectionIdFromQuery) return;

    // Only set if it exists in the loaded options; avoids selecting stale IDs.
    const exists = classSections.some((cs) => cs.id === classSectionIdFromQuery);
    if (exists) {
      setSelectedClassSectionId(classSectionIdFromQuery);
    }
  }, [searchParams, classSections]);

  useEffect(() => {
    if (!selectedClassSectionId) return;
    if (classSections.length === 0) return;
    const stillVisible = classSections.some((cs) => cs.id === selectedClassSectionId);
    if (!stillVisible) {
      setSelectedClassSectionId(null);
    }
  }, [classSections, selectedClassSectionId]);

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

  const selectedClassSectionLabel = useMemo(() => {
    if (!selectedClassSectionId) return null;
    const cs = classSections.find((c) => c.id === selectedClassSectionId);
    if (!cs) return null;
    return `${cs.className || cs.classDisplayName || t('unknown')} - ${cs.sectionName || t('unknown')}`;
  }, [selectedClassSectionId, classSections, t]);

  const timetablePageTitle = selectedClassSectionLabel
    ? t('pageTitleWithClassSection', { title: t('title'), classSection: selectedClassSectionLabel })
    : t('title');

  const timetablePageLoadingSections =
    isLoadingActiveYear ||
    (scopeClassSectionsToTeachingStaff && isLoadingMyStaff) ||
    isLoadingClassSections;

  if (timetablePageLoadingSections) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{timetablePageTitle}</Title>
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
          <Title order={1}>{timetablePageTitle}</Title>
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

  if (
    scopeClassSectionsToTeachingStaff &&
    !isLoadingMyStaff &&
    !myStaffRecord
  ) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{timetablePageTitle}</Title>
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
          <Alert color={colors.info} title={t('noStaffRecord')}>
            <Text size="sm">{t('noStaffRecordMessage')}</Text>
          </Alert>
        </div>
      </>
    );
  }

  if (classSectionsError) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{timetablePageTitle}</Title>
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
          <Title order={1}>{timetablePageTitle}</Title>
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
              {scopeClassSectionsToTeachingStaff
                ? t('noClassSectionsAssignedToTeacher')
                : t('noActiveClassSections')}
            </Text>
          </Paper>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>{timetablePageTitle}</Title>
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
