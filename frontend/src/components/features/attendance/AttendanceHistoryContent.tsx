'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Group,
  Button,
  Stack,
  Paper,
  MultiSelect,
  Box,
  Select,
  Pagination,
  Chip,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconDownload, IconFilter } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useAttendance } from '@/hooks/useAttendance';
import { useClassSections } from '@/hooks/useClassSections';
import { AttendanceReport } from '@/components/features/attendance/AttendanceReport';
import { useMyStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import { useStudent, useStudents } from '@/hooks/useStudents';
import type { User } from '@/types/auth';
import type { Student } from '@/types/students';
import '@mantine/dates/styles.css';
import { apiClient } from '@/lib/api-client';
import { notifications } from '@mantine/notifications';

type DatePreset = 'today' | 'last7' | 'last30';

function studentToSelectOption(s: Student): { value: string; label: string } {
  const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  const suffix = s.studentId ? ` (${s.studentId})` : '';
  const label = `${name}${suffix}`.trim();
  return { value: s.id, label: label || s.id };
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive calendar windows ending today. */
function rangeForPreset(preset: DatePreset): [Date, Date] {
  const end = startOfLocalDay(new Date());
  const start = new Date(end);
  if (preset === 'last7') start.setDate(end.getDate() - 6);
  else if (preset === 'last30') start.setDate(end.getDate() - 29);
  return [start, end];
}

function matchesPreset(range: [Date | null, Date | null], preset: DatePreset): boolean {
  const [start, end] = range;
  if (!start || !end) return false;
  const [pStart, pEnd] = rangeForPreset(preset);
  return toLocalIsoDate(start) === toLocalIsoDate(pStart) && toLocalIsoDate(end) === toLocalIsoDate(pEnd);
}

/**
 * Attendance history filters and table report.
 * Used in the main Attendance page (History tab) and on the standalone /attendance/history page.
 */
export function AttendanceHistoryContent() {
  const t = useTranslations('attendance');
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [selectedClassSectionIds, setSelectedClassSectionIds] = useState<string[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [debouncedStudentSearch] = useDebouncedValue(studentSearchInput, 300);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset | null>('last7');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => rangeForPreset('last7'));
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

  const hasAutoSelectedClass = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedClass.current) return;
    if (classSections.length === 0) return;
    const sorted = [...classSections].sort((a, b) => {
      const classOrderA = a.classSortOrder ?? 999;
      const classOrderB = b.classSortOrder ?? 999;
      if (classOrderA !== classOrderB) return classOrderA - classOrderB;
      const sectionOrderA = a.sectionSortOrder ?? 999;
      const sectionOrderB = b.sectionSortOrder ?? 999;
      return sectionOrderA - sectionOrderB;
    });
    const first = sorted[0];
    if (first?.id) {
      hasAutoSelectedClass.current = true;
      setSelectedClassSectionIds([first.id]);
    }
  }, [classSections]);

  const classIdsForStudentPicker = useMemo(() => {
    if (selectedClassSectionIds.length > 0) {
      const ids = selectedClassSectionIds
        .map((sid) => classSections.find((cs) => cs.id === sid)?.classId)
        .filter((id): id is string => !!id);
      return [...new Set(ids)];
    }
    const all = classSections.map((cs) => cs.classId).filter((id): id is string => !!id);
    return [...new Set(all)];
  }, [selectedClassSectionIds, classSections]);

  const { data: studentsData } = useStudents({
    page: 1,
    limit: 100,
    search: debouncedStudentSearch.trim() || undefined,
    isActive: true,
    ...(classIdsForStudentPicker.length > 0 ? { classIds: classIdsForStudentPicker } : {}),
  });

  const studentsFromQuery = studentsData?.data ?? [];
  const needsSelectedStudentDetail =
    !!selectedStudentId &&
    !studentsFromQuery.some((s) => s.id === selectedStudentId);
  const { data: selectedStudentDetail } = useStudent(
    needsSelectedStudentDetail ? selectedStudentId : null,
  );

  const studentSelectData = useMemo(() => {
    const map = new Map<string, { value: string; label: string }>();
    for (const s of studentsFromQuery) {
      map.set(s.id, studentToSelectOption(s));
    }
    if (selectedStudentDetail) {
      map.set(selectedStudentDetail.id, studentToSelectOption(selectedStudentDetail));
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [studentsFromQuery, selectedStudentDetail]);

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset);
    setDateRange(rangeForPreset(preset));
    setTablePage(1);
  };

  const commonParams = {
    classSectionIds:
      selectedClassSectionIds.length > 0 ? selectedClassSectionIds : undefined,
    studentId: selectedStudentId ?? undefined,
    statuses:
      selectedStatuses.length > 0
        ? (selectedStatuses as ('present' | 'absent' | 'late' | 'excused')[])
        : undefined,
    startDate: dateRange[0] && dateRange[1] ? toLocalIsoDate(dateRange[0]) : undefined,
    endDate: dateRange[0] && dateRange[1] ? toLocalIsoDate(dateRange[1]) : undefined,
  };

  const { data: tableData, isLoading } = useAttendance({
    ...commonParams,
    page: tablePage,
    limit: 100,
  });

  const attendance = tableData?.data || [];
  const tableMeta = tableData?.meta;

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
          <Group gap="xs" wrap="wrap" align="center" className="filter-chip-group">
            <Text size="sm" fw={500}>
              {t('periodLabel')}
            </Text>
            <Chip.Group
              value={datePreset ?? ''}
              onChange={(v) => {
                const next = (Array.isArray(v) ? v[0] : v) as DatePreset | '' | undefined;
                if (next === 'today' || next === 'last7' || next === 'last30') {
                  applyPreset(next);
                }
              }}
            >
              <Group gap="xs" wrap="wrap">
                <Chip id="attendance-history-filter-today" value="today" variant="filled">
                  {t('filterToday')}
                </Chip>
                <Chip id="attendance-history-filter-last7" value="last7" variant="filled">
                  {t('filterLast7Days')}
                </Chip>
                <Chip id="attendance-history-filter-last30" value="last30" variant="filled">
                  {t('filterLast30Days')}
                </Chip>
              </Group>
            </Chip.Group>
          </Group>

          <Group wrap="wrap" align="flex-end" gap="sm">
            <Box style={{ minWidth: 0, flex: '1 1 200px' }}>
              <MultiSelect
                label={t('classSection')}
                placeholder={t('selectClassSections')}
                data={classSectionOptions}
                value={selectedClassSectionIds}
                onChange={(v) => {
                  setSelectedClassSectionIds(v);
                  setTablePage(1);
                }}
                searchable
                clearable
              />
            </Box>
            <Box style={{ minWidth: 0, flex: '1 1 240px' }}>
              <DatePickerInput
                id="attendance-history-filter-date-range"
                type="range"
                label={t('dateRange')}
                placeholder={t('dateRangePlaceholder')}
                value={dateRange}
                onChange={(v) => {
                  let next: [Date | null, Date | null];
                  if (!v || (Array.isArray(v) && !v[0] && !v[1])) {
                    next = [null, null];
                  } else {
                    next = v as [Date | null, Date | null];
                  }
                  setDateRange(next);
                  if (matchesPreset(next, 'today')) setDatePreset('today');
                  else if (matchesPreset(next, 'last7')) setDatePreset('last7');
                  else if (matchesPreset(next, 'last30')) setDatePreset('last30');
                  else setDatePreset(null);
                  setTablePage(1);
                }}
                leftSection={<IconCalendar size={16} />}
                clearable
              />
            </Box>
            <Box style={{ minWidth: 0, flex: '1 1 220px' }}>
              <Select
                id="attendance-history-filter-student"
                label={t('student')}
                placeholder={t('searchByStudentNameOrId')}
                data={studentSelectData}
                value={selectedStudentId}
                onChange={(v) => {
                  setSelectedStudentId(v);
                  setTablePage(1);
                }}
                searchable
                searchValue={studentSearchInput}
                onSearchChange={(v) => {
                  setStudentSearchInput(v);
                  setTablePage(1);
                }}
                filter={({ options }) => options}
                clearable
                nothingFoundMessage={t('noStudentsFound')}
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
                    onChange={(v) => {
                      setSelectedStatuses(v);
                      setTablePage(1);
                    }}
                    clearable
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
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={async () => {
                try {
                  const queryParams = new URLSearchParams();
                  if (commonParams.startDate) queryParams.append('startDate', commonParams.startDate);
                  if (commonParams.endDate) queryParams.append('endDate', commonParams.endDate);
                  if (commonParams.studentId) queryParams.append('studentId', commonParams.studentId);
                  if (commonParams.classSectionIds && commonParams.classSectionIds.length > 0) {
                    commonParams.classSectionIds.forEach((id) => queryParams.append('classSectionIds', id));
                  }
                  if (commonParams.statuses && commonParams.statuses.length > 0) {
                    commonParams.statuses.forEach((s) => queryParams.append('statuses', s));
                  }

                  const { blob, filename } = await apiClient.getBlobWithFilename(
                    `/api/v1/attendance/export?${queryParams.toString()}`,
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename ?? 'attendance-history.xlsx';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (e: unknown) {
                  notifications.show({
                    title: t('exportErrorTitle'),
                    message: e instanceof Error ? e.message : t('exportErrorMessage'),
                    color: 'red',
                  });
                }
              }}
            >
              {t('export')}
            </Button>
            <Button
              variant="subtle"
              onClick={() => {
                setSelectedClassSectionIds([]);
                setSelectedStudentId(null);
                setStudentSearchInput('');
                setSelectedStatuses([]);
                applyPreset('last7');
              }}
            >
              {t('clear')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Box pt="md">
        <AttendanceReport
          attendance={attendance}
          isLoading={isLoading}
          startDate={commonParams.startDate}
          endDate={commonParams.endDate}
        />
        {tableMeta && tableMeta.totalPages > 1 ? (
          <Group justify="flex-end" mt="sm">
            <Pagination value={tablePage} onChange={setTablePage} total={tableMeta.totalPages} />
          </Group>
        ) : null}
      </Box>
    </Stack>
  );
}
