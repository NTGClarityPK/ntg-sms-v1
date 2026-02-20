'use client';

import { useState } from 'react';
import {
  Group,
  Button,
  Stack,
  Paper,
  MultiSelect,
  SegmentedControl,
  Box,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconTable, IconFilter } from '@tabler/icons-react';
import { useAttendance } from '@/hooks/useAttendance';
import { useClassSections } from '@/hooks/useClassSections';
import { AttendanceCalendar } from '@/components/features/attendance/AttendanceCalendar';
import { AttendanceReport } from '@/components/features/attendance/AttendanceReport';
import { useMyStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import '@mantine/dates/styles.css';

/**
 * Attendance history filters + calendar/table views.
 * Used in the main Attendance page (History tab) and on the standalone /attendance/history page.
 */
export function AttendanceHistoryContent() {
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('table');
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [selectedClassSectionIds, setSelectedClassSectionIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: myStaffData } = useMyStaff();
  const staffData = myStaffData?.data;

  const isClassTeacher = userTyped?.roles?.some((r) => r.roleName === 'class_teacher');
  const isAdmin = userTyped?.roles?.some((r) => r.roleName === 'school_admin' || r.roleName === 'principal');

  const { data: classSectionsData } = useClassSections({
    isActive: true,
    classTeacherId: isClassTeacher && !isAdmin && staffData?.id ? staffData.id : undefined,
  });
  const classSections = classSectionsData?.data || [];

  const [page] = useState(1);
  const { data: attendanceData, isLoading } = useAttendance({
    classSectionIds: selectedClassSectionIds.length > 0 ? selectedClassSectionIds : undefined,
    statuses: selectedStatuses.length > 0 ? (selectedStatuses as ('present' | 'absent' | 'late' | 'excused')[]) : undefined,
    page,
    limit: 100,
  });

  let attendance = attendanceData?.data || [];
  if (startDate) {
    const startDateString = startDate.toISOString().split('T')[0];
    attendance = attendance.filter((a) => a.date >= startDateString);
  }
  if (endDate) {
    const endDateString = endDate.toISOString().split('T')[0];
    attendance = attendance.filter((a) => a.date <= endDateString);
  }

  const classSectionOptions = classSections
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
      label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
    }));

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group wrap="wrap" align="flex-end" gap="sm">
            <Box style={{ minWidth: 0, flex: '1 1 200px' }}>
              <MultiSelect
                label="Class-Section"
                placeholder="Select class-sections"
                data={classSectionOptions}
                value={selectedClassSectionIds}
                onChange={setSelectedClassSectionIds}
                searchable
                clearable
              />
            </Box>
            {showAllFilters && (
              <>
                <Box style={{ minWidth: 0, flex: '1 1 160px' }}>
                  <MultiSelect
                    label="Status"
                    placeholder="Select statuses"
                    data={[
                      { value: 'present', label: 'Present' },
                      { value: 'absent', label: 'Absent' },
                      { value: 'late', label: 'Late' },
                      { value: 'excused', label: 'Excused' },
                    ]}
                    value={selectedStatuses}
                    onChange={setSelectedStatuses}
                    clearable
                  />
                </Box>
                <Box style={{ minWidth: 0, flex: '1 1 140px' }}>
                  <DatePickerInput
                    label="Start Date"
                    placeholder="Start"
                    value={startDate}
                    onChange={setStartDate}
                    leftSection={<IconCalendar size={16} />}
                  />
                </Box>
                <Box style={{ minWidth: 0, flex: '1 1 140px' }}>
                  <DatePickerInput
                    label="End Date"
                    placeholder="End"
                    value={endDate}
                    onChange={setEndDate}
                    leftSection={<IconCalendar size={16} />}
                    minDate={startDate || undefined}
                  />
                </Box>
              </>
            )}
            <Button
              variant={showAllFilters ? 'light' : 'subtle'}
              leftSection={<IconFilter size={16} />}
              onClick={() => setShowAllFilters((v) => !v)}
            >
              {showAllFilters ? 'Fewer filters' : 'Show more filters'}
            </Button>
            <Button
              variant="subtle"
              onClick={() => {
                setSelectedClassSectionIds([]);
                setSelectedStatuses([]);
                setStartDate(null);
                setEndDate(null);
              }}
            >
              Clear
            </Button>
          </Group>
        </Stack>
      </Paper>

      <SegmentedControl
        value={viewMode}
        onChange={(value) => setViewMode(value as 'calendar' | 'table')}
        data={[
          { label: 'Calendar View', value: 'calendar' },
          { label: 'Table View', value: 'table' },
        ]}
        fullWidth
        size="sm"
      />

      {viewMode === 'calendar' && (
        <Box pt="md">
          <AttendanceCalendar
            attendance={attendance}
            isLoading={isLoading}
            startDate={startDate}
            endDate={endDate}
          />
        </Box>
      )}

      {viewMode === 'table' && (
        <Box pt="md">
          <AttendanceReport
            attendance={attendance}
            isLoading={isLoading}
            startDate={startDate ? startDate.toISOString().split('T')[0] : undefined}
            endDate={endDate ? endDate.toISOString().split('T')[0] : undefined}
          />
        </Box>
      )}
    </Stack>
  );
}
