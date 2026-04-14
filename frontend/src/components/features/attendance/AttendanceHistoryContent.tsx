'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('attendance');
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

  const isTeacher = userTyped?.roles?.some((r) => {
    const role = r.roleName?.toLowerCase();
    return role === 'class_teacher' || role === 'subject_teacher';
  });
  const isAdmin = userTyped?.roles?.some((r) => {
    const role = r.roleName?.toLowerCase();
    return role === 'school_admin' || role === 'principal';
  });

  const { data: classSectionsData } = useClassSections({
    isActive: true,
    classTeacherId: isTeacher && !isAdmin && staffData?.id ? staffData.id : undefined,
  });
  const classSections = classSectionsData?.data || [];

  // Calendar needs enough rows to cover multiple days (rows scale with student count).
  // Backend caps `limit` at 500, so fetch a few pages when in calendar view.
  const calendarLimit = 500;
  const calendarPages = 3; // 3×500 = 1500 rows (~11+ days @ 129 students/day)

  const commonParams = {
    classSectionIds:
      selectedClassSectionIds.length > 0 ? selectedClassSectionIds : undefined,
    statuses:
      selectedStatuses.length > 0
        ? (selectedStatuses as ('present' | 'absent' | 'late' | 'excused')[])
        : undefined,
  };

  const { data: tableData, isLoading: isTableLoading } = useAttendance({
    ...commonParams,
    page: 1,
    limit: 100,
  });

  const { data: calData1, isLoading: isCalLoading1 } = useAttendance({
    ...commonParams,
    page: 1,
    limit: calendarLimit,
  });
  const { data: calData2, isLoading: isCalLoading2 } = useAttendance({
    ...commonParams,
    page: viewMode === 'calendar' ? 2 : 999999, // keep hook stable, avoid loading extra pages in table mode
    limit: calendarLimit,
  });
  const { data: calData3, isLoading: isCalLoading3 } = useAttendance({
    ...commonParams,
    page: viewMode === 'calendar' ? 3 : 999999,
    limit: calendarLimit,
  });

  const isLoading =
    viewMode === 'calendar'
      ? isCalLoading1 || isCalLoading2 || isCalLoading3
      : isTableLoading;

  const attendanceData =
    viewMode === 'calendar'
      ? {
          data: [
            ...(calData1?.data ?? []),
            ...(calData2?.data ?? []),
            ...(calData3?.data ?? []),
          ],
        }
      : tableData;

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
                label={t('classSection')}
                placeholder={t('selectClassSections')}
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
                    label={t('status')}
                    placeholder={t('selectStatuses')}
                    data={[
                      { value: 'present', label: t('present') },
                      { value: 'absent', label: t('absent') },
                      { value: 'late', label: t('late') },
                      { value: 'excused', label: t('excused') },
                    ]}
                    value={selectedStatuses}
                    onChange={setSelectedStatuses}
                    clearable
                  />
                </Box>
                <Box style={{ minWidth: 0, flex: '1 1 140px' }}>
                  <DatePickerInput
                    label={t('startDate')}
                    placeholder={t('startPlaceholder')}
                    value={startDate}
                    onChange={setStartDate}
                    leftSection={<IconCalendar size={16} />}
                  />
                </Box>
                <Box style={{ minWidth: 0, flex: '1 1 140px' }}>
                  <DatePickerInput
                    label={t('endDate')}
                    placeholder={t('endPlaceholder')}
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
              {showAllFilters ? t('fewerFilters') : t('showMoreFilters')}
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
              {t('clear')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <SegmentedControl
        value={viewMode}
        onChange={(value) => setViewMode(value as 'calendar' | 'table')}
        data={[
          { label: t('calendarView'), value: 'calendar' },
          { label: t('tableView'), value: 'table' },
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
