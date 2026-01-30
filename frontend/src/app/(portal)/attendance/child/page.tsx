'use client';

import { useState, useEffect } from 'react';
import {
  Group,
  Title,
  Select,
  Stack,
  Paper,
  Text,
  Avatar,
  Badge,
  Skeleton,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconUser } from '@tabler/icons-react';
import { useAttendanceByStudent, useAttendanceSummaryByStudent } from '@/hooks/useAttendance';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AttendanceCalendar } from '@/components/features/attendance/AttendanceCalendar';
import { AttendanceReport } from '@/components/features/attendance/AttendanceReport';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useSearchParams } from 'next/navigation';
import type { User } from '@/types/auth';

interface Child {
  id: string;
  parentUserId: string;
  studentId: string;
  relationship: 'father' | 'mother' | 'guardian';
  isPrimary: boolean;
  canApprove: boolean;
  createdAt: string;
  parentName?: string;
  studentName?: string;
  studentStudentId?: string; // student's student_id field (e.g., "ST001")
}

export default function ChildAttendancePage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const notifyColors = useThemeColors();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Get children list
  const userId = (user as User | undefined)?.id;
  const { data: childrenData, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['parent-children', userId],
    queryFn: async () => {
      if (!userId) return null;
      // Backend returns { data: Child[] }
      // apiClient.get<Child[]> returns ApiResponse<Child[]> = { data: Child[], meta?, error? }
      const response = await apiClient.get<Child[]>(
        `/api/v1/parents/${userId}/children`,
      );
      // response.data is Child[], so we return it directly
      return response.data;
    },
    enabled: !!userId,
  });

  // Extract children array from response
  // childrenData is Child[], so we use it directly
  const children = Array.isArray(childrenData) ? childrenData : [];

  // Get current child from user profile or use first child
  const userTyped = user as User | undefined;
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      // Check if user has current_student_id set
      const currentChildId = (userTyped as any)?.currentStudentId as string | undefined;
      // Use studentId (UUID) for matching, not the association id
      if (currentChildId && children.some((c) => c.studentId === currentChildId)) {
        setSelectedChildId(currentChildId);
      } else {
        setSelectedChildId(children[0].studentId);
      }
    }
  }, [children, selectedChildId, userTyped]);

  // Get date from URL params if present
  const dateFromUrl = searchParams?.get('date');

  const { data: attendanceData, isLoading: isLoadingAttendance } =
    useAttendanceByStudent(selectedChildId, undefined, undefined);

  const { data: summaryData, isLoading: isLoadingSummary } =
    useAttendanceSummaryByStudent(selectedChildId);

  const attendance = attendanceData || [];
  const summary = summaryData || null;

  const selectedChild = children.find((c) => c.studentId === selectedChildId);

  if (isLoadingChildren) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Child Attendance</Title>
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
          <Stack gap="md" py="xl">
            <Skeleton height={40} width="30%" />
            <Skeleton height={300} />
            <Skeleton height={200} />
          </Stack>
        </div>
      </>
    );
  }

  if (children.length === 0) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Child Attendance</Title>
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
          <Alert icon={<IconAlertCircle size={16} />} color={notifyColors.warning}>
            <Text size="sm">
              No children linked to your account. Please contact the school
              administrator.
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Child Attendance</Title>
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
          {children.length > 1 && (
            <Paper withBorder p="md">
              <Select
                label="Select Child"
                placeholder="Choose a child"
                data={children.map((c) => ({
                  value: c.studentId, // Use studentId (UUID) as value, not the association id
                  label: c.studentName || `Student ${c.studentStudentId || c.studentId}`,
                }))}
                value={selectedChildId}
                onChange={(value) => setSelectedChildId(value)}
                leftSection={<IconUser size={16} />}
              />
            </Paper>
          )}

          {selectedChild && (
            <>
              <Paper withBorder p="md">
                <Group gap="md">
                  <Avatar size="lg" radius="xl">
                    {selectedChild.studentName
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'ST'}
                  </Avatar>
                  <Stack gap={2}>
                    <Text fw={500} size="lg">
                      {selectedChild.studentName || 'Student'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Student ID: {selectedChild.studentStudentId || selectedChild.studentId}
                    </Text>
                  </Stack>
                </Group>
              </Paper>

              {summary && (
                <Paper withBorder p="md">
                  <Stack gap="md">
                    <Text fw={500} size="lg">
                      Attendance Summary
                    </Text>
                    <Group grow>
                      <Stack gap="xs" align="center">
                        <Text size="sm" c="dimmed">
                          Present
                        </Text>
                        <Badge variant="light" color={notifyColors.success} size="lg">
                          {summary.presentDays}
                        </Badge>
                      </Stack>
                      <Stack gap="xs" align="center">
                        <Text size="sm" c="dimmed">
                          Absent
                        </Text>
                        <Badge variant="light" color={notifyColors.error} size="lg">
                          {summary.absentDays}
                        </Badge>
                      </Stack>
                      <Stack gap="xs" align="center">
                        <Text size="sm" c="dimmed">
                          Late
                        </Text>
                        <Badge variant="light" color={notifyColors.warning} size="lg">
                          {summary.lateDays}
                        </Badge>
                      </Stack>
                      <Stack gap="xs" align="center">
                        <Text size="sm" c="dimmed">
                          Attendance Rate
                        </Text>
                        <Text fw={600} size="xl">
                          {summary.percentage}%
                        </Text>
                      </Stack>
                    </Group>
                  </Stack>
                </Paper>
              )}

              {(isLoadingAttendance || isLoadingSummary) ? (
                <Stack gap="md" py="xl">
                  <Skeleton height={200} />
                  <Skeleton height={300} />
                  <Skeleton height={400} />
                </Stack>
              ) : (
                <>
                  <AttendanceCalendar
                    attendance={attendance}
                    isLoading={false}
                    startDate={null}
                    endDate={null}
                    isSingleStudent={true}
                  />
                  <AttendanceReport
                    attendance={attendance}
                    isLoading={false}
                    startDate={undefined}
                    endDate={undefined}
                  />
                </>
              )}
            </>
          )}
        </Stack>
      </div>
    </>
  );
}

