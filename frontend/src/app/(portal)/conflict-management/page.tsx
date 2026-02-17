'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@mantine/core';
import { IconAlertTriangle, IconExternalLink, IconRefresh } from '@tabler/icons-react';
import { useConflicts } from '@/hooks/useTimetable';
import { useClassSections } from '@/hooks/useClassSections';
import { useStaff } from '@/hooks/useStaff';
import { useActiveAcademicYear, useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { Conflict } from '@/types/timetable';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getConflictTypeLabel(type: string): string {
  switch (type) {
    case 'teacher_double_booking':
      return 'Teacher Double Booking';
    case 'invalid_school_day':
      return 'Invalid School Day';
    case 'class_section_slot_overlap':
      return 'Class-Section Slot Overlap';
    case 'timing_mismatch':
      return 'Timing Mismatch';
    default:
      return type;
  }
}

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
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);

  const { data: classSectionsData, isLoading: isLoadingClassSections } = useClassSections({
    isActive: true,
  });
  const { data: staffData, isLoading: isLoadingStaff } = useStaff({ isActive: true });
  const { data: activeYear } = useActiveAcademicYear();
  const { data: academicYearsData } = useAcademicYearsList();

  const { data: conflictsData, isLoading: isLoadingConflicts, refetch } = useConflicts({
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
      label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
    }));

  const staffOptions = staff.map((s) => ({
    value: s.id,
    label: s.fullName || 'Unknown',
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
    router.push(`/timetable/class/${classSectionId}`);
  };

  const handleViewStaffSchedule = (staffId: string) => {
    router.push(`/staff/${staffId}/schedule`);
  };

  const handleClearFilters = () => {
    setSelectedClassSectionId(null);
    setSelectedStaffId(null);
    setSelectedAcademicYearId(null);
  };

  if (isLoadingClassSections || isLoadingStaff || !classSectionsData || !staffData) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Conflict Management</Title>
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

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Conflict Management</Title>
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={() => refetch()}
            variant="light"
          >
            Refresh
          </Button>
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
            View and manage scheduling conflicts for student courses and teacher timings. Conflicts
            can occur within a class-section or across multiple class-sections.
          </Text>

          {/* Filters */}
          <Paper p="md" withBorder>
            <Stack gap="md">
              <Group grow>
                <Select
                  label="Academic Year"
                  placeholder="Select academic year"
                  data={academicYearOptions}
                  value={selectedAcademicYearId}
                  onChange={(value) => setSelectedAcademicYearId(value)}
                  clearable
                  searchable
                />
                <Select
                  label="Class Section"
                  placeholder="Filter by class-section"
                  data={classSectionOptions}
                  value={selectedClassSectionId}
                  onChange={(value) => setSelectedClassSectionId(value)}
                  clearable
                  searchable
                />
                <Select
                  label="Staff Member"
                  placeholder="Filter by staff"
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
                    Clear Filters
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
                  Conflict Summary
                </Text>
                <Group gap="xs">
                  {Object.entries(conflictSummary).map(([type, count]) => (
                    <Badge
                      key={type}
                      color={getConflictTypeColor(type)}
                      size="lg"
                      variant="light"
                    >
                      {getConflictTypeLabel(type)}: {count}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Paper>
          )}

          {/* Conflicts List */}
          {isLoadingConflicts ? (
            <Stack gap="md">
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </Stack>
          ) : conflicts.length === 0 ? (
            <Paper p="xl" withBorder>
              <Text c="dimmed" ta="center">
                No conflicts found. All timetables are properly scheduled.
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
                          {getConflictTypeLabel(conflict.type)}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          Day: {DAY_NAMES[conflict.dayOfWeek] || `Day ${conflict.dayOfWeek}`}
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
                            Conflicting Slots:
                          </Text>
                          {conflict.conflictingSlots.map((slot, slotIndex) => (
                            <Group key={slotIndex} justify="space-between" wrap="nowrap">
                              <Text size="sm">
                                {slot.className} {slot.sectionName} - {slot.startTime} to{' '}
                                {slot.endTime}
                              </Text>
                              <Button
                                size="xs"
                                variant="subtle"
                                leftSection={<IconExternalLink size={14} />}
                                onClick={() => handleViewClassTimetable(slot.classSectionId)}
                              >
                                View Timetable
                              </Button>
                            </Group>
                          ))}
                        </Stack>
                      </>
                    )}

                    {conflict.staffId && (
                      <>
                        <Divider />
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            Affected Staff
                          </Text>
                          <Button
                            size="xs"
                            variant="subtle"
                            leftSection={<IconExternalLink size={14} />}
                            onClick={() => handleViewStaffSchedule(conflict.staffId!)}
                          >
                            View Staff Schedule
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
