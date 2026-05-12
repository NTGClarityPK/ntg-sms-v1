'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Group,
  Button,
  Stack,
  Paper,
  Box,
  MultiSelect,
  Select,
  Table,
  ScrollArea,
  Skeleton,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconFilter } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { EarlyDepartureTable } from '@/components/features/early-departure/EarlyDepartureTable';
import { EarlyDepartureReport } from '@/components/features/early-departure/EarlyDepartureReport';
import { useStudents, useStudent } from '@/hooks/useStudents';
import type { Student } from '@/types/students';
import type { EarlyDepartureStatus } from '@/types/early-departure';
import '@mantine/dates/styles.css';

function studentToSelectOption(s: Student): { value: string; label: string } {
  const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  const suffix = s.studentId ? ` (${s.studentId})` : '';
  const label = `${name}${suffix}`.trim();
  return { value: s.id, label: label || s.id };
}

export type EarlyDepartureActionFilter = 'all' | 'pending_only' | 'non_pending';

export interface EarlyDepartureHistoryContentProps {
  isParent: boolean;
  canEdit: boolean;
  studentNameMap: Map<string, string>;
  scopedStudentId: string | null;
  onScopedStudentIdChange?: (id: string | null) => void;
  scopedStudentSelectData?: { value: string; label: string }[];
  showScopedStudentSelect?: boolean;
}

export function EarlyDepartureHistoryContent({
  isParent,
  canEdit,
  studentNameMap: studentNameMapProp,
  scopedStudentId,
  onScopedStudentIdChange,
  scopedStudentSelectData,
  showScopedStudentSelect,
}: EarlyDepartureHistoryContentProps) {
  const t = useTranslations('earlyDeparture');
  const isStaffView = !isParent;

  const [showAllFilters, setShowAllFilters] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [debouncedStudentSearch] = useDebouncedValue(studentSearchInput, 300);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [actionFilter, setActionFilter] =
    useState<EarlyDepartureActionFilter>('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return [start, end];
  });

  const { data: studentsData } = useStudents({
    page: 1,
    limit: 100,
    search: debouncedStudentSearch.trim() || undefined,
    isActive: true,
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

  const statusesForApi = useMemo((): EarlyDepartureStatus[] | undefined => {
    if (actionFilter === 'pending_only') {
      return ['pending'];
    }
    if (actionFilter === 'non_pending') {
      return ['approved', 'rejected', 'cancelled', 'excused'];
    }
    if (selectedStatuses.length > 0) {
      return selectedStatuses as EarlyDepartureStatus[];
    }
    return undefined;
  }, [actionFilter, selectedStatuses]);

  const startDateStr =
    dateRange[0] && dateRange[1] ? dateRange[0].toISOString().split('T')[0] : undefined;
  const endDateStr =
    dateRange[0] && dateRange[1] ? dateRange[1].toISOString().split('T')[0] : undefined;

  const studentIdForQuery = useMemo(() => {
    if (isParent) {
      return scopedStudentId ?? undefined;
    }
    return selectedStudentId ?? undefined;
  }, [isParent, scopedStudentId, selectedStudentId]);

  const requestsQuery = useEarlyDepartures({
    page: tablePage,
    limit: 20,
    studentId: studentIdForQuery,
    statuses: statusesForApi,
    startDate: startDateStr,
    endDate: endDateStr,
  });

  const requests = requestsQuery.data?.data ?? [];
  const meta = requestsQuery.data?.meta;

  const mergedNameMap = useMemo(() => {
    const m = new Map(studentNameMapProp);
    for (const s of studentsFromQuery) {
      const label = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
      if (label) m.set(s.id, label);
    }
    if (selectedStudentDetail) {
      const label = `${selectedStudentDetail.firstName ?? ''} ${selectedStudentDetail.lastName ?? ''}`.trim();
      if (label) m.set(selectedStudentDetail.id, label);
    }
    return m;
  }, [studentNameMapProp, studentsFromQuery, selectedStudentDetail]);

  const prevFiltersKey = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify({
      startDateStr,
      endDateStr,
      studentIdForQuery,
      statusesForApi,
      actionFilter,
      selectedStatuses,
    });
    if (prevFiltersKey.current === key) return;
    prevFiltersKey.current = key;
    setTablePage(1);
  }, [
    startDateStr,
    endDateStr,
    studentIdForQuery,
    statusesForApi,
    actionFilter,
    selectedStatuses,
  ]);

  const actionFilterData = useMemo(
    () => [
      { value: 'all', label: t('historyActionFilterAll') },
      { value: 'pending_only', label: t('historyActionFilterPending') },
      { value: 'non_pending', label: t('historyActionFilterNonPending') },
    ],
    [t],
  );

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group wrap="wrap" align="flex-end" gap="sm">
            <Box style={{ minWidth: 0, flex: '1 1 240px' }}>
              <DatePickerInput
                id="early-departure-history-filter-date-range"
                type="range"
                label={t('historyDateRange')}
                placeholder={t('historyDateRangePlaceholder')}
                value={dateRange}
                onChange={(v) => {
                  if (!v || (Array.isArray(v) && !v[0] && !v[1])) {
                    setDateRange([null, null]);
                  } else {
                    setDateRange(v as [Date | null, Date | null]);
                  }
                }}
                leftSection={<IconCalendar size={16} />}
                clearable
              />
            </Box>

            {showScopedStudentSelect && scopedStudentSelectData && onScopedStudentIdChange ? (
              <Box style={{ minWidth: 0, flex: '1 1 220px' }}>
                <Select
                  id="early-departure-history-scoped-student"
                  label={t('selectStudent')}
                  placeholder={t('historyFilterAllStudents')}
                  data={scopedStudentSelectData}
                  value={scopedStudentId}
                  onChange={(v) => onScopedStudentIdChange(v)}
                  searchable
                  clearable
                />
              </Box>
            ) : null}

            {isStaffView ? (
              <Box style={{ minWidth: 0, flex: '1 1 220px' }}>
                <Select
                  id="early-departure-history-filter-student"
                  label={t('student')}
                  placeholder={t('historySearchStudent')}
                  data={studentSelectData}
                  value={selectedStudentId}
                  onChange={(v) => setSelectedStudentId(v)}
                  searchable
                  searchValue={studentSearchInput}
                  onSearchChange={(v) => setStudentSearchInput(v)}
                  filter={({ options }) => options}
                  clearable
                  nothingFoundMessage={t('historyNoStudentsFound')}
                />
              </Box>
            ) : null}

            <Box style={{ minWidth: 0, flex: '1 1 200px' }}>
              <Select
                id="early-departure-history-action-filter"
                label={t('historyActionFilter')}
                data={actionFilterData}
                value={actionFilter}
                onChange={(v) =>
                  setActionFilter((v as EarlyDepartureActionFilter) ?? 'all')
                }
              />
            </Box>

            {showAllFilters && actionFilter === 'all' ? (
              <Box style={{ minWidth: 0, flex: '1 1 220px' }}>
                <MultiSelect
                  id="early-departure-history-statuses"
                  label={t('status')}
                  placeholder={t('historySelectStatuses')}
                  data={[
                    { value: 'pending', label: t('pending') },
                    { value: 'approved', label: t('approved') },
                    { value: 'rejected', label: t('rejected') },
                    { value: 'cancelled', label: t('cancelled') },
                    { value: 'excused', label: t('excused') },
                  ]}
                  value={selectedStatuses}
                  onChange={(v) => setSelectedStatuses(v)}
                  clearable
                />
              </Box>
            ) : null}

            <Button
              variant={showAllFilters ? 'light' : 'subtle'}
              leftSection={<IconFilter size={16} />}
              onClick={() => setShowAllFilters((v) => !v)}
            >
              {showAllFilters ? t('historyFewerFilters') : t('historyShowMoreFilters')}
            </Button>

            <Button
              variant="subtle"
              id="early-departure-history-clear-filters"
              onClick={() => {
                setSelectedStudentId(null);
                onScopedStudentIdChange?.(null);
                setStudentSearchInput('');
                setSelectedStatuses([]);
                setActionFilter('all');
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 6);
                setDateRange([start, end]);
              }}
            >
              {t('historyClearFilters')}
            </Button>
          </Group>
        </Stack>
      </Paper>

      <EarlyDepartureReport
        requests={requests}
        isLoading={requestsQuery.isLoading || requestsQuery.isRefetching}
        startDate={startDateStr}
        endDate={endDateStr}
      />

      {requestsQuery.isLoading || requestsQuery.isRefetching ? (
        <ScrollArea type="auto" scrollbars="x" w="100%">
          <Table striped highlightOnHover style={{ minWidth: 960 }}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('dateRequested')}</Table.Th>
                <Table.Th>{t('departureDateAndTime')}</Table.Th>
                <Table.Th>{t('student')}</Table.Th>
                <Table.Th>{t('reason')}</Table.Th>
                <Table.Th>{t('status')}</Table.Th>
                <Table.Th>{t('reviewedBy')}</Table.Th>
                <Table.Th>{t('dateReviewed')}</Table.Th>
                <Table.Th>{t('reviewNotes')}</Table.Th>
                <Table.Th>{t('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} width={60} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} />
                  </Table.Td>
                  <Table.Td>
                    <Skeleton height={20} width={100} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      ) : requestsQuery.error ? (
        <Text size="sm" c="dimmed">
          {t('failedToLoadRequests')}
        </Text>
      ) : requests.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('noEarlyDepartureRequestsShort')}
        </Text>
      ) : (
        <EarlyDepartureTable
          requests={requests}
          meta={meta}
          onPageChange={setTablePage}
          isStaffView={isStaffView}
          canEdit={canEdit}
          studentNameMap={mergedNameMap}
        />
      )}
    </Stack>
  );
}
