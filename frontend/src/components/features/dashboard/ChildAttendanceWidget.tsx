'use client';

import {
  Paper,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Skeleton,
  Alert,
} from '@mantine/core';
import { IconUserCheck, IconEye } from '@tabler/icons-react';
import { useAttendanceByStudent } from '@/hooks/useAttendance';
import { useAuth } from '@/hooks/useAuth';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth';

interface Child {
  id: string;
  studentId: string;
  studentName?: string;
}

export function ChildAttendanceWidget() {
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const notifyColors = useThemeColors();

  // Get current child
  const { data: childrenData } = useQuery({
    queryKey: ['parent-children', userTyped?.id],
    queryFn: async () => {
      if (!userTyped?.id) return null;
      const response = await apiClient.get<{ data: Child[] }>(
        `/api/v1/parents/${userTyped.id}/children`,
      );
      return response.data?.data;
    },
    enabled: !!userTyped?.id,
  });

  const children = childrenData || [];
  const currentChildId = (userTyped as any)?.currentStudentId || children[0]?.id;
  const currentChild = children.find((c) => c.id === currentChildId);

  // Get today's date
  const today = new Date().toISOString().split('T')[0];

  // Get today's attendance
  const { data: attendanceData, isLoading } = useAttendanceByStudent(
    currentChildId || null,
    today,
    today,
  );

  if (!currentChild) {
    return null; // Don't show widget if no child selected
  }

  if (isLoading) {
    return (
      <Paper withBorder p="md">
        <Stack gap="md">
          <Skeleton height={30} width="60%" />
          <Skeleton height={100} />
          <Skeleton height={40} />
        </Stack>
      </Paper>
    );
  }

  const attendance = attendanceData || [];
  const todayAttendance = attendance.find((a) => a.date === today);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'present':
        return notifyColors.success;
      case 'absent':
        return notifyColors.error;
      case 'late':
        return notifyColors.warning;
      case 'excused':
        return notifyColors.info;
      default:
        return 'gray';
    }
  };

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        <Group justify="space-between">
          <Stack gap={2}>
            <Text fw={500} size="lg">
              Today&apos;s Attendance
            </Text>
            <Text size="sm" c="dimmed">
              {currentChild.studentName || 'Student'}
            </Text>
          </Stack>
        </Group>

        {!todayAttendance ? (
          <Alert color={notifyColors.warning}>
            <Text size="sm">No attendance marked for today</Text>
          </Alert>
        ) : (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Status
              </Text>
              <Badge
                variant="light"
                color={getStatusColor(todayAttendance.status)}
                size="lg"
              >
                {todayAttendance.status.toUpperCase()}
              </Badge>
            </Group>
            {todayAttendance.entryTime && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Entry Time
                </Text>
                <Text fw={500}>{todayAttendance.entryTime}</Text>
              </Group>
            )}
            {todayAttendance.exitTime && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Exit Time
                </Text>
                <Text fw={500}>{todayAttendance.exitTime}</Text>
              </Group>
            )}
          </Stack>
        )}

        <Button
          component={Link}
          href="/attendance/child"
          leftSection={<IconEye size={18} />}
          variant="light"
          fullWidth
        >
          View Full History
        </Button>
      </Stack>
    </Paper>
  );
}

