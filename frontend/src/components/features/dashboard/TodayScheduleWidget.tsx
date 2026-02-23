'use client';

import { Stack, Text, Skeleton, Alert } from '@mantine/core';
import { useMyStudent } from '@/hooks/useStudents';
import { useStudentTimetable } from '@/hooks/useTimetable';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TodayScheduleWidget() {
  const colors = useThemeColors();
  const { data: myStudentData } = useMyStudent();
  const studentId = myStudentData?.data?.id ?? null;
  const { data: timetableResponse, isLoading, error } = useStudentTimetable(studentId);
  const timetable = timetableResponse?.data;

  if (!studentId) {
    return null;
  }

  if (error) {
    return (
      <Alert color={colors.error} title="Error">
        {error instanceof Error ? error.message : 'Failed to load timetable'}
      </Alert>
    );
  }

  if (isLoading || !timetableResponse) {
    return (
      <Stack gap="sm">
        <Skeleton height={20} width="80%" />
        <Skeleton height={60} />
      </Stack>
    );
  }

  const todayDayOfWeek = new Date().getDay();
  const todaySlots = (timetable?.slots ?? []).filter(
    (s) => s.dayOfWeek === todayDayOfWeek,
  );

  return (
    <Stack gap="sm">
      <Text size="sm" fw={500}>
        {DAY_NAMES[todayDayOfWeek]}
      </Text>
      {todaySlots.length === 0 ? (
        <Text size="sm" c="dimmed">
          No classes today
        </Text>
      ) : (
        todaySlots.slice(0, 5).map((slot) => (
          <Text key={slot.id} size="sm">
            {slot.startTime}–{slot.endTime} {slot.subjectName ?? 'Period'}
          </Text>
        ))
      )}
    </Stack>
  );
}
