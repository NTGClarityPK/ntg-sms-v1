'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Title,
  Text,
  Select,
  Stack,
  Skeleton,
  Paper,
  Group,
  Badge,
  Button,
  Alert,
  Card,
  Divider,
  Tooltip,
  ActionIcon,
  Anchor,
} from '@mantine/core';
import { IconAlertTriangle, IconExternalLink, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useConflicts } from '@/hooks/useTimetable';
import { useClassSections } from '@/hooks/useClassSections';
import { useStaff } from '@/hooks/useStaff';
import { useActiveAcademicYear, useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { Conflict } from '@/types/timetable';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getConflictTypeColor(type: string): string {
  switch (type) {
    case 'teacher_double_booking':
      return 'red';
    case 'invalid_school_day':
      return 'orange';
    case 'class_section_slot_overlap':
      return 'yellow';
    case 'timing_mismatch':
      return 'blue';
    default:
      return 'gray';
  }
}

export default function ConflictManagementPage() {
  const t = useTranslations('timetable');
  const queryClient = useQueryClient();
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);

  const { data: classSectionsData, isLoading: isLoadingClassSections } = useClassSections({
    isActive: true,
  });
  const { data: staffData, isLoading: isLoadingStaff } = useStaff({ isActive: true });
  const {
    data: activeYear,
    isLoading: activeYearLoading,
    error: activeYearError,
  } = useActiveAcademicYear();
  const { data: academicYearsData } = useAcademicYearsList();

  const { data: conflictsData, isLoading: isLoadingConflicts, isRefetching } = useConflicts({
    classSectionId: selectedClassSectionId ?? undefined,
    staffId: selectedStaffId ?? undefined,
    academicYearId: selectedAcademicYearId ?? undefined,
  });

  const conflicts = conflictsData?.data || [];
  const classSections = classSectionsData?.data || [];
  const staff = staffData?.data?.data || [];
  const academicYears = academicYearsData?.data || [];

  // Set default academic year to active year
  const effectiveAcademicYearId = selectedAcademicYearId || activeYear?.data?.id || null;

  // Format options for selects
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

  const staffOptions = staff.map((s) => ({
    value: s.id,
    label: s.fullName || t('unknown'),
  }));

  const academicYearOptions = academicYears.map((ay) => ({
    value: ay.id,
    label: ay.name,
  }));

  // Group conflicts by type for summary
  const conflictSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    conflicts.forEach((conflict) => {
      summary[conflict.type] = (summary[conflict.type] || 0) + 1;
    });
    return summary;
  }, [conflicts]);

  const handleViewClassTimetable = (classSectionId: string) => {
    router.push(`/timetable?classSectionId=${encodeURIComponent(classSectionId)}`);
  };

  const handleViewStaffSchedule = (staffId: string) => {
    router.push(`/staff/${staffId}/schedule`);
  };

  const handleClearFilters = () => {
    setSelectedClassSectionId(null);
    setSelectedStaffId(null);
    setSelectedAcademicYearId(null);
  };

  if (activeYearLoading || isLoadingClassSections || isLoadingStaff) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('conflictManagement')}</Title>
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

  if (activeYearError || !effectiveAcademicYearId) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>{t('conflictManagement')}</Title>
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
              {t('noActiveAcademicYearConflictsMessage')}{' '}
              <Anchor component={Link} href="/settings/academic-years">
                {t('settingsAcademicYears')}
              </Anchor>
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('conflictManagement')}</Title>
          <Tooltip label={t('refresh')}>
            <ActionIcon
              variant="light"
              size="lg"
              loading={isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['timetable', 'conflicts'] })}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
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
        <Stack gap="xl">
          <Text c="dimmed">
            {t('viewAndManageDescription')}
          </Text>

          {/* Filters */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group grow>
                <Select
                  label={t('academicYear')}
                  placeholder={t('selectAcademicYear')}
                  data={academicYearOptions}
                  value={selectedAcademicYearId}
                  onChange={(value) => setSelectedAcademicYearId(value)}
                  clearable
                  searchable
                />
                <Select
                  label={t('selectClassSection')}
                  placeholder={t('filterByClassSection')}
                  data={classSectionOptions}
                  value={selectedClassSectionId}
                  onChange={(value) => setSelectedClassSectionId(value)}
                  clearable
                  searchable
                />
                <Select
                  label={t('staffMember')}
                  placeholder={t('filterByStaff')}
                  data={staffOptions}
                  value={selectedStaffId}
                  onChange={(value) => setSelectedStaffId(value)}
                  clearable
                  searchable
                />
              </Group>
              {(selectedClassSectionId || selectedStaffId || selectedAcademicYearId) && (
                <Group justify="flex-end">
                  <Button variant="subtle" size="xs" onClick={handleClearFilters}>
                    {t('clearFilters')}
                  </Button>
                </Group>
              )}
            </Stack>
          </Paper>

          {/* Summary */}
          {Object.keys(conflictSummary).length > 0 && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Text fw={500} size="sm">
                  {t('conflictSummary')}
                </Text>
                <Group gap="xs">
                  {Object.entries(conflictSummary).map(([type, count]) => (
                    <Badge
                      key={type}
                      color={getConflictTypeColor(type)}
                      size="lg"
                      variant="light"
                    >
                      {t(`conflictType_${type}` as 'conflictType_teacher_double_booking' | 'conflictType_invalid_school_day' | 'conflictType_class_section_slot_overlap' | 'conflictType_timing_mismatch', { defaultValue: type })}: {count}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}

          {/* Conflicts List */}
          {isLoadingConflicts || isRefetching ? (
            <Stack gap="md">
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </Stack>
          ) : conflicts.length === 0 ? (
            <Paper p="xl" withBorder>
              <Text c="dimmed" ta="center">
                {t('noConflictsFound')}
              </Text>
            </Paper>
          ) : (
            <Stack gap="md">
              {conflicts.map((conflict, index) => (
                <Card key={index} withBorder padding="md" radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Badge color={getConflictTypeColor(conflict.type)} variant="light">
                          {t(`conflictType_${conflict.type}` as 'conflictType_teacher_double_booking' | 'conflictType_invalid_school_day' | 'conflictType_class_section_slot_overlap' | 'conflictType_timing_mismatch', { defaultValue: conflict.type })}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {t('day')}: {DAY_NAMES[conflict.dayOfWeek] || t('dayNumber', { number: conflict.dayOfWeek })}
                        </Text>
                        {conflict.subjectTemplateName && (
                          <Badge color="blue" variant="light" size="sm">
                            {conflict.subjectTemplateName}
                          </Badge>
                        )}
                      </Group>
                      <Text size="sm" fw={500}>
                        {conflict.message}
                      </Text>
                    </Group>

                    {conflict.conflictingSlots.length > 0 && (
                      <>
                        <Divider />
                        <Stack gap="xs">
                          <Text size="xs" fw={500} c="dimmed">
                            {t('conflictingSlots')}
                          </Text>
                          {/* Show unique "View timetable" options per class section */}
                          <Group gap="xs" wrap="wrap">
                            {Array.from(
                              new Map(
                                conflict.conflictingSlots.map((s) => [
                                  s.classSectionId,
                                  {
                                    classSectionId: s.classSectionId,
                                    label: `${s.className ?? t('unknown')} ${s.sectionName ?? ''}`.trim(),
                                  },
                                ]),
                              ).values(),
                            ).map((cs) => (
                              <Button
                                key={cs.classSectionId}
                                size="xs"
                                variant="light"
                                leftSection={<IconExternalLink size={14} />}
                                onClick={() => handleViewClassTimetable(cs.classSectionId)}
                              >
                                {cs.label} {t('viewTimetable')}
                              </Button>
                            ))}
                          </Group>

                          {/* Still list individual conflicting slots (times) for context */}
                          <Stack gap={4} mt={6}>
                            {conflict.conflictingSlots.map((slot, slotIndex) => (
                              <Text key={`${slot.id}-${slotIndex}`} size="sm" c="dimmed">
                                {slot.className} {slot.sectionName} - {slot.startTime} to {slot.endTime}
                              </Text>
                            ))}
                          </Stack>
                        </Stack>
                      </>
                    )}

                    {conflict.staffId && (
                      <>
                        <Divider />
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            {t('affectedStaff')}
                          </Text>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconExternalLink size={14} />}
                            onClick={() => handleViewStaffSchedule(conflict.staffId!)}
                          >
                            {t('viewStaffSchedule')}
                          </Button>
                        </Group>
                      </>
                    )}
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </div>
    </>
  );
}
