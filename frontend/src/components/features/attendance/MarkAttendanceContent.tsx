'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('attendance');
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: myStaffData } = useMyStaff();
  const staffData = myStaffData?.data;

  const isTeacher = userTyped?.roles?.some((r) => {
    const role = r.roleName?.toLowerCase();
    return role === 'class_teacher' || role === 'subject_teacher';
  });

  const { data: classSectionsData } = useClassSections({
    isActive: true,
    classTeacherId: isTeacher && staffData?.id ? staffData.id : undefined,
  });
  const classSections = classSectionsData?.data || [];

  const dateString = selectedDate ? selectedDate.toISOString().split('T')[0] : null;

  const { data: attendanceData, isLoading: isLoadingAttendance } =
    useAttendanceByClassAndDate(selectedClassSectionId, dateString);

  const attendance = attendanceData || [];
  const selectedClassSection = classSections.find((cs) => cs.id === selectedClassSectionId);

  return (
    <Stack gap="md">
      <Paper
        withBorder
        p="md"
        radius="md"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <Stack gap="md">
          <Group grow>
            <Select
              label={t('classSection')}
              placeholder={t('selectClassSection')}
              data={classSections
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
                }))}
              value={selectedClassSectionId}
              onChange={setSelectedClassSectionId}
              leftSection={<IconCalendar size={16} />}
              searchable
            />
            <DatePickerInput
              label={t('date')}
              placeholder={t('selectDate')}
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
                {t('clearSelection')}
              </Button>
            </Group>
          )}
        </Stack>
      </Paper>

      {selectedClassSectionId && dateString && (
        <>
          <AttendanceStats attendance={attendance} totalStudents={attendance.length} />
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
        <Text size="sm" c="dimmed" ta="center" py="xl">
          {t('selectClassSectionAndDateHint')}
        </Text>
      )}
    </Stack>
  );
}
