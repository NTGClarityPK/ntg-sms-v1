'use client';

import { useTranslations } from 'next-intl';
import { Paper, Stack, Text, Skeleton, Group, Badge } from '@mantine/core';
import type { Attendance } from '@/types/attendance';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

interface AttendanceCalendarProps {
  attendance: Attendance[];
  isLoading: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  isSingleStudent?: boolean; // If true, shows single status per day instead of counts
}

export function AttendanceCalendar({
  attendance,
  isLoading,
  startDate,
  endDate,
  isSingleStudent = false,
}: AttendanceCalendarProps) {
  const t = useTranslations('attendance');
  const notifyColors = useThemeColors();

  if (isLoading) {
    return (
      <Paper withBorder p="xl">
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={200} />
          <Skeleton height={200} />
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

  // For single student view, show only the status for that day
  if (isSingleStudent) {
    const dateStats = Array.from(attendanceByDate.entries()).map(
      ([date, records]) => {
        // For single student, there should be only one record per day
        const record = records[0];
        return {
          date,
          status: record?.status || null,
          entryTime: record?.entryTime || null,
          exitTime: record?.exitTime || null,
        };
      },
    );

    // Sort by date
    dateStats.sort((a, b) => a.date.localeCompare(b.date));

    const getStatusColor = (status: string | null) => {
      switch (status) {
        case 'present':
          return notifyColors.success;
        case 'late':
          return notifyColors.warning;
        case 'absent':
          return notifyColors.error;
        case 'excused':
          return notifyColors.info;
        default:
          return 'gray';
      }
    };

    const getStatusLabel = (status: string | null) => {
      switch (status) {
        case 'present':
          return t('present');
        case 'late':
          return t('late');
        case 'absent':
          return t('absent');
        case 'excused':
          return t('excused');
        default:
          return t('noRecord');
      }
    };

    return (
      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={500} size="lg">
            {t('attendanceCalendar')}
          </Text>
          {dateStats.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {t('noAttendanceForPeriod')}
            </Text>
          ) : (
            <Stack gap="xs">
              {dateStats.map((stat) => (
                <Paper key={stat.date} withBorder p="sm">
                  <Group justify="space-between">
                    <Text fw={500}>
                      {new Date(stat.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <Group gap="xs">
                      <Badge
                        variant="light"
                        color={getStatusColor(stat.status)}
                        size="md"
                      >
                        {getStatusLabel(stat.status)}
                      </Badge>
                      {stat.entryTime && (
                        <Text size="sm" c="dimmed">
                          {t('entryLabel')}: {stat.entryTime.slice(0, 5)}
                        </Text>
                      )}
                      {stat.exitTime && (
                        <Text size="sm" c="dimmed">
                          {t('exitLabel')}: {stat.exitTime.slice(0, 5)}
                        </Text>
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

  // Multi-student view (class-level) - show counts and percentages
  const dateStats = Array.from(attendanceByDate.entries()).map(
    ([date, records]) => {
      const presentCount = records.filter((r) => r.status === 'present').length;
      const absentCount = records.filter((r) => r.status === 'absent').length;
      const lateCount = records.filter((r) => r.status === 'late').length;
      const excusedCount = records.filter((r) => r.status === 'excused').length;
      const total = records.length;
      const presentPercentage =
        total > 0
          ? Math.round(((presentCount + lateCount) / total) * 100)
          : 0;

      return {
        date,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        total,
        presentPercentage,
      };
    },
  );

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
          {t('attendanceCalendar')}
        </Text>
        {dateStats.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('noAttendanceForPeriod')}
          </Text>
        ) : (
          <Stack gap="xs">
            {dateStats.map((stat) => (
              <Paper key={stat.date} withBorder p="sm">
                <Group justify="space-between">
                  <Group gap="md">
                    <Text fw={500}>{new Date(stat.date).toLocaleDateString()}</Text>
                    <Badge variant="light" color={getDateColor(stat.presentPercentage)}>
                      {t('percentPresent', { percent: stat.presentPercentage })}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <Badge variant="light" color={notifyColors.success} size="sm">
                      {t('countPresent', { count: stat.presentCount })}
                    </Badge>
                    <Badge variant="light" color={notifyColors.error} size="sm">
                      {t('countAbsent', { count: stat.absentCount })}
                    </Badge>
                    {stat.lateCount > 0 && (
                      <Badge
                        variant="light"
                        color={notifyColors.warning}
                        size="sm"
                      >
                        {t('countLate', { count: stat.lateCount })}
                      </Badge>
                    )}
                    {stat.excusedCount > 0 && (
                      <Badge variant="light" color={notifyColors.info} size="sm">
                        {t('countExcused', { count: stat.excusedCount })}
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



