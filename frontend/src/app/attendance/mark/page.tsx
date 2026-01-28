'use client';

import { useState } from 'react';
import { Group, Title, Select, Button, Stack, Paper } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconX } from '@tabler/icons-react';
import { useAttendanceByClassAndDate, useBulkMarkAttendance } from '@/hooks/useAttendance';
import { useClassSections } from '@/hooks/useClassSections';
import { AttendanceSheet } from '@/components/features/attendance/AttendanceSheet';
import { AttendanceStats } from '@/components/features/attendance/AttendanceStats';
import { useAcademicYearsList } from '@/hooks/useAcademicYears';
import { useMyStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import '@mantine/dates/styles.css';

export default function MarkAttendancePage() {
  const [selectedClassSectionId, setSelectedClassSectionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const { data: myStaffData } = useMyStaff();
  const staffData = myStaffData?.data;
  
  // Check if user is a class teacher
  const isClassTeacher = userTyped?.roles?.some((r) => r.roleName === 'class_teacher');
  
  // Filter class sections by class teacher if user is a class teacher
  const { data: classSectionsData } = useClassSections({ 
    isActive: true,
    classTeacherId: isClassTeacher && staffData?.id ? staffData.id : undefined,
  });
  const classSections = classSectionsData?.data || [];

  const { data: academicYearsData } = useAcademicYearsList({ page: 1, limit: 10 });
  const activeYear = academicYearsData?.data?.find((y) => y.isActive);

  const dateString = selectedDate ? selectedDate.toISOString().split('T')[0] : null;

  const { data: attendanceData, isLoading: isLoadingAttendance } =
    useAttendanceByClassAndDate(selectedClassSectionId, dateString);

  const attendance = attendanceData || [];

  const selectedClassSection = classSections.find(
    (cs) => cs.id === selectedClassSectionId,
  );

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Mark Attendance</Title>
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
                <Select
                  label="Class-Section"
                  placeholder="Select class-section"
                  data={classSections.map((cs) => ({
                    value: cs.id,
                    label: `${cs.className || cs.classDisplayName || 'Unknown'} - ${cs.sectionName || 'Unknown'}`,
                  }))}
                  value={selectedClassSectionId}
                  onChange={(value) => setSelectedClassSectionId(value)}
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
                <Title order={4} c="dimmed">
                  Select a class-section and date to mark attendance
                </Title>
              </Stack>
            </Paper>
          )}
        </Stack>
      </div>
    </>
  );
}


