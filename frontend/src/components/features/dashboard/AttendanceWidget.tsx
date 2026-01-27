'use client';

import {
  Paper,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Progress,
  Loader,
  Alert,
} from '@mantine/core';
import { IconCalendarCheck, IconEye } from '@tabler/icons-react';
import { useAttendanceSummaryByClass } from '@/hooks/useAttendance';
import { useClassSections } from '@/hooks/useClassSections';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/auth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface ClassSection {
  id: string;
  className?: string;
  classDisplayName?: string;
  sectionName?: string;
  classTeacherId?: string;
}

export function AttendanceWidget() {
  const { user } = useAuth();
  const notifyColors = useThemeColors();

  // Get class-sections where this user is the class teacher
  // We need to find staff by user_id, then find class-sections where staff.id = class_teacher_id
  const userTyped = user as User | undefined;
  const { data: staffData } = useQuery({
    queryKey: ['staff-by-user', userTyped?.id, userTyped?.currentBranch?.id],
    queryFn: async () => {
      if (!userTyped?.id || !userTyped?.currentBranch?.id) return null;
      // Get all staff in the branch and find the one matching user_id
      const response = await apiClient.get<{ data: Array<{ id: string; userId: string }> }>(
        `/api/v1/staff?limit=1000`,
      );
      return response.data?.data?.find((s) => s.userId === userTyped.id);
    },
    enabled: !!userTyped?.id && !!userTyped?.currentBranch?.id,
  });

  // Get class-sections where this staff is the class teacher
  const { data: classSectionsData } = useClassSections({ isActive: true });
  const classSections = classSectionsData?.data || [];
  const teacherClassSection = classSections.find(
    (cs) => cs.classTeacherId === staffData?.id,
  );

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Get today's attendance summary
  const { data: summaryData, isLoading } = useAttendanceSummaryByClass(
    teacherClassSection?.id || null,
    today,
    today,
  );

  if (!teacherClassSection) {
    return null; // Don't show widget if user is not a class teacher
  }

  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500} size="lg">
              Today&apos;s Attendance
            </Text>
            <Loader size="sm" />
          </Group>
        </Stack>
      </Paper>
    );
  }

  const summary = summaryData || null;
  const presentCount = summary?.presentDays || 0;
  const absentCount = summary?.absentDays || 0;
  const lateCount = summary?.lateDays || 0;
  const total = summary?.totalDays || 0;
  const percentage = summary?.percentage || 0;

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Stack gap={2}>
            <Text fw={500} size="lg">
              Today&apos;s Attendance
            </Text>
            <Text size="sm" c="dimmed">
              {teacherClassSection.className || teacherClassSection.classDisplayName} -{' '}
              {teacherClassSection.sectionName}
            </Text>
          </Stack>
        </Group>

        {total === 0 ? (
          <Alert color={notifyColors.warning}>
            <Text size="sm">No attendance marked for today</Text>
          </Alert>
        ) : (
          <>
            <Group grow>
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  Present
                </Text>
                <Badge variant="light" color={notifyColors.success} size="lg">
                  {presentCount}
                </Badge>
              </Stack>
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  Absent
                </Text>
                <Badge variant="light" color={notifyColors.error} size="lg">
                  {absentCount}
                </Badge>
              </Stack>
              <Stack gap="xs" align="center">
                <Text size="sm" c="dimmed">
                  Late
                </Text>
                <Badge variant="light" color={notifyColors.warning} size="lg">
                  {lateCount}
                </Badge>
              </Stack>
            </Group>

            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Attendance Rate
                </Text>
                <Text fw={600}>{percentage}%</Text>
              </Group>
              <Progress value={percentage} color={notifyColors.success} />
            </Stack>
          </>
        )}

        <Group grow>
          <Button
            component={Link}
            href="/attendance/mark"
            leftSection={<IconCalendarCheck size={18} />}
            variant="light"
          >
            Mark Attendance
          </Button>
          <Button
            component={Link}
            href="/attendance/history"
            leftSection={<IconEye size={18} />}
            variant="subtle"
          >
            View History
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

