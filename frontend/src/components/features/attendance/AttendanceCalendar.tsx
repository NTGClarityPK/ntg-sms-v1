'use client';

import { Paper, Stack, Text, Loader, Group, Badge } from '@mantine/core';
import type { Attendance } from '@/types/attendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface AttendanceCalendarProps {
  attendance: Attendance[];
  isLoading: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
}

export function AttendanceCalendar({
  attendance,
  isLoading,
  startDate,
  endDate,
}: AttendanceCalendarProps) {
  const notifyColors = useThemeColors();

  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading attendance calendar...</Text>
        </Stack>
      </Paper>
    );
  }

  // Group attendance by date
  const attendanceByDate = new Map<string, Attendance[]>();
  attendance.forEach((a) => {
    const date = a.date;
    if (!attendanceByDate.has(date)) {
      attendanceByDate.set(date, []);
    }
    attendanceByDate.get(date)!.push(a);
  });

  // Calculate statistics for each date
  const dateStats = Array.from(attendanceByDate.entries()).map(([date, records]) => {
    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;
    const lateCount = records.filter((r) => r.status === 'late').length;
    const total = records.length;
    const presentPercentage = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

    return {
      date,
      presentCount,
      absentCount,
      lateCount,
      total,
      presentPercentage,
    };
  });

  // Sort by date
  dateStats.sort((a, b) => a.date.localeCompare(b.date));

  const getDateColor = (percentage: number) => {
    if (percentage >= 90) return notifyColors.success;
    if (percentage >= 70) return notifyColors.warning;
    return notifyColors.error;
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Text fw={500} size="lg">
          Attendance Calendar
        </Text>
        {dateStats.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No attendance records found for the selected period
          </Text>
        ) : (
          <Stack gap="xs">
            {dateStats.map((stat) => (
              <Paper key={stat.date} withBorder p="sm">
                <Group justify="space-between">
                  <Group gap="md">
                    <Text fw={500}>{new Date(stat.date).toLocaleDateString()}</Text>
                    <Badge variant="light" color={getDateColor(stat.presentPercentage)}>
                      {stat.presentPercentage}% Present
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <Badge variant="light" color={notifyColors.success} size="sm">
                      {stat.presentCount} Present
                    </Badge>
                    <Badge variant="light" color={notifyColors.error} size="sm">
                      {stat.absentCount} Absent
                    </Badge>
                    {stat.lateCount > 0 && (
                      <Badge variant="light" color={notifyColors.warning} size="sm">
                        {stat.lateCount} Late
                      </Badge>
                    )}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}


