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

interface ChildAttendanceWidgetProps {
  /** When true, omit outer Paper and title (for use inside WidgetContainer) */
  embedded?: boolean;
}

export function ChildAttendanceWidget({ embedded }: ChildAttendanceWidgetProps = {}) {
  const { user } = useAuth();
  const userTyped = user as User | undefined;
  const notifyColors = useThemeColors();

  // Get current child
  const { data: childrenData } = useQuery({
    queryKey: ['parent-children', userTyped?.id],
    queryFn: async () => {
      if (!userTyped?.id) return [];
      // apiClient.get<Child[]> returns ApiResponse<Child[]> = { data: Child[], ... }
      const response = await apiClient.get<Child[]>(
        `/api/v1/parents/${userTyped.id}/children`,
      );
      return response.data || [];
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
    const content = (
      <Stack gap="md">
        <Skeleton height={30} width="60%" />
        <Skeleton height={100} />
        <Skeleton height={40} />
      </Stack>
    );
    return embedded ? content : <Paper withBorder p="md">{content}</Paper>;
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

  const content = (
    <Stack gap="md">
      {!embedded && (
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
      )}

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

      {!embedded && (
        <Button
          id="dashboard-link-attendance-child"
          component={Link}
          href="/attendance/child"
          leftSection={<IconEye size={18} />}
          variant="light"
          fullWidth
        >
          View Full History
        </Button>
      )}
    </Stack>
  );
  return embedded ? content : <Paper withBorder p="md">{content}</Paper>;
}

