'use client';

import { useState } from 'react';
import { Group, Select, Button, Stack, Paper, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconX } from '@tabler/icons-react';
import { useAttendanceByClassAndDate } from '@/hooks/useAttendance';
import { useClassSections } from '@/hooks/useClassSections';
import { AttendanceSheet } from '@/components/features/attendance/AttendanceSheet';
import { AttendanceStats } from '@/components/features/attendance/AttendanceStats';
import { useMyStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import '@mantine/dates/styles.css';

/**
 * Mark attendance: class-section + date filters, stats, and sheet.
 * Used in the main Attendance page (Mark Attendance tab) and on the standalone /attendance/mark page.
 */
export function MarkAttendanceContent() {
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: myStaffData } = useMyStaff();
  const staffData = myStaffData?.data;

  const isClassTeacher = userTyped?.roles?.some((r) => r.roleName === 'class_teacher');

  const { data: classSectionsData } = useClassSections({
    isActive: true,
    classTeacherId: isClassTeacher && staffData?.id ? staffData.id : undefined,
  });
  const classSections = classSectionsData?.data || [];

  const dateString = selectedDate ? selectedDate.toISOString().split('T')[0] : null;

  const { data: attendanceData, isLoading: isLoadingAttendance } =
    useAttendanceByClassAndDate(selectedClassSectionId, dateString);

  const attendance = attendanceData || [];
  const selectedClassSection = classSections.find((cs) => cs.id === selectedClassSectionId);

  return (
    <Stack gap="md">
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group grow>
            <Select
              label="Class-Section"
              placeholder="Select class-section"
              data={classSections.map((cs) => ({
                value: cs.id,
                label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
              }))}
              value={selectedClassSectionId}
              onChange={setSelectedClassSectionId}
              leftSection={<IconCalendar size={16} />}
              searchable
            />
            <DatePickerInput
              label="Date"
              placeholder="Select date"
              value={selectedDate}
              onChange={setSelectedDate}
              leftSection={<IconCalendar size={16} />}
              maxDate={new Date()}
            />
          </Group>
          {selectedClassSectionId && dateString && (
            <Group>
              <Button
                variant="subtle"
                leftSection={<IconX size={16} />}
                onClick={() => {
                  setSelectedClassSectionId(null);
                  setSelectedDate(new Date());
                }}
              >
                Clear Selection
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      {selectedClassSectionId && dateString && (
        <>
          <AttendanceStats
            attendance={attendance}
            totalStudents={attendance.length}
          />
          <AttendanceSheet
            classSectionId={selectedClassSectionId}
            date={dateString}
            attendance={attendance}
            isLoading={isLoadingAttendance}
            className={selectedClassSection?.className || ''}
            sectionName={selectedClassSection?.sectionName || ''}
          />
        </>
      )}

      {!selectedClassSectionId && (
        <Paper withBorder p="xl">
          <Stack align="center" gap="sm">
            <IconCalendar size={48} style={{ opacity: 0.5 }} />
            <Group justify="center">
              <Select
                placeholder="Select class-section"
                data={classSections.map((cs) => ({
                  value: cs.id,
                  label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
                }))}
                value={selectedClassSectionId}
                onChange={setSelectedClassSectionId}
                leftSection={<IconCalendar size={16} />}
                searchable
                style={{ minWidth: 280 }}
              />
            </Group>
            <Text size="sm" c="dimmed">
              Select a class-section and date to mark attendance
            </Text>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
