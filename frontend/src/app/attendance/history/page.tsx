'use client';

import { useState } from 'react';
import {
  Group,
  Title,
  Select,
  Button,
  Stack,
  Paper,
  Tabs,
  MultiSelect,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconTable, IconChartBar } from '@tabler/icons-react';
import { useAttendance } from '@/hooks/useAttendance';
import { useClassSections } from '@/hooks/useClassSections';
import { AttendanceCalendar } from '@/components/features/attendance/AttendanceCalendar';
import { AttendanceReport } from '@/components/features/attendance/AttendanceReport';
import '@mantine/dates/styles.css';

export default function AttendanceHistoryPage() {
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('table');
  const [selectedClassSectionIds, setSelectedClassSectionIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const { data: classSectionsData } = useClassSections({ isActive: true });
  const classSections = classSectionsData?.data || [];

  const { data: attendanceData, isLoading } = useAttendance({
    classSectionIds: selectedClassSectionIds.length > 0 ? selectedClassSectionIds : undefined,
    statuses: selectedStatuses.length > 0 ? (selectedStatuses as any) : undefined,
    limit: 1000, // Get all records for history view
  });

  // Filter by date range on frontend (backend doesn't support date ranges yet)
  let attendance = attendanceData?.data || [];
  if (startDate) {
    const startDateString = startDate.toISOString().split('T')[0];
    attendance = attendance.filter((a) => a.date >= startDateString);
  }
  if (endDate) {
    const endDateString = endDate.toISOString().split('T')[0];
    attendance = attendance.filter((a) => a.date <= endDateString);
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Attendance History</Title>
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
        <Stack gap="md">
          <Paper withBorder p="md">
            <Stack gap="md">
              <Group grow>
                <MultiSelect
                  label="Class-Section"
                  placeholder="Select class-sections"
                  data={classSections.map((cs) => ({
                    value: cs.id,
                    label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
                  }))}
                  value={selectedClassSectionIds}
                  onChange={setSelectedClassSectionIds}
                  searchable
                  clearable
                />
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
                <DatePickerInput
                  label="Start Date"
                  placeholder="Select start date"
                  value={startDate}
                  onChange={setStartDate}
                  leftSection={<IconCalendar size={16} />}
                />
                <DatePickerInput
                  label="End Date"
                  placeholder="Select end date"
                  value={endDate}
                  onChange={setEndDate}
                  leftSection={<IconCalendar size={16} />}
                  minDate={startDate || undefined}
                />
              </Group>
              <Group>
                <Button
                  variant="subtle"
                  onClick={() => {
                    setSelectedClassSectionIds([]);
                    setSelectedStatuses([]);
                    setStartDate(null);
                    setEndDate(null);
                  }}
                >
                  Clear Filters
                </Button>
              </Group>
            </Stack>
          </Paper>

          <Tabs value={viewMode} onChange={(value) => setViewMode(value as 'calendar' | 'table')}>
            <Tabs.List>
              <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
                Calendar View
              </Tabs.Tab>
              <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>
                Table View
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="calendar" pt="md">
              <AttendanceCalendar
                attendance={attendance}
                isLoading={isLoading}
                startDate={startDate}
                endDate={endDate}
              />
            </Tabs.Panel>

            <Tabs.Panel value="table" pt="md">
              <AttendanceReport
                attendance={attendance}
                isLoading={isLoading}
                startDate={startDate ? startDate.toISOString().split('T')[0] : undefined}
                endDate={endDate ? endDate.toISOString().split('T')[0] : undefined}
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </div>
    </>
  );
}

