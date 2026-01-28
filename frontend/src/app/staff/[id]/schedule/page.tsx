'use client';

import { Title, Loader, Text, Stack, Card, Group, Badge } from '@mantine/core';
import { useStaffSchedule } from '@/hooks/useStaffSchedule';
import { useStaff } from '@/hooks/useStaff';
import { useClassSections } from '@/hooks/useClassSections';
import { useParams } from 'next/navigation';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useMemo } from 'react';

export default function StaffSchedulePage() {
  const params = useParams();
  const staffId = (params?.id as string) || null;
  const { data: scheduleData, isLoading, error } = useStaffSchedule(staffId);
  const { data: staffData } = useStaff();
  const { data: classSectionsData } = useClassSections();
  const colors = useThemeColors();

  const staff = (staffData as { data?: Array<{ id: string; fullName?: string | null; employeeId?: string | null }> } | null | undefined)?.data?.find(
    (s) => s.id === staffId,
  );
  const schedule = scheduleData?.data;
  const classSections = classSectionsData?.data || [];

  // Create a map of class-section IDs to names
  const classSectionMap = useMemo(() => {
    const map = new Map<string, string>();
    classSections.forEach((cs) => {
      const name = `${cs.classDisplayName || cs.className || 'Unknown'} - ${cs.sectionName || 'Unknown'}`;
      map.set(cs.id, name);
    });
    return map;
  }, [classSections]);

  if (isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Teacher Schedule</Title>
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
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>Teacher Schedule</Title>
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
          <Text c="red">
            Error loading schedule: {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
        </div>
      </>
    );
  }

  const teacherName = staff?.fullName || staff?.employeeId || 'Unknown';

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>Teacher Schedule: {teacherName}</Title>
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
          {schedule && schedule.classTeacherOf.length > 0 && (
            <Card withBorder p="md">
              <Title order={3} mb="md">
                Class Teacher Of
              </Title>
              <Stack gap="sm">
                {schedule.classTeacherOf.map((cs) => (
                  <Group key={cs.classSectionId} justify="space-between">
                    <Text>
                      {cs.className} - {cs.sectionName}
                    </Text>
                    <Badge variant="light" color={colors.success}>
                      Class Teacher
                    </Badge>
                  </Group>
                ))}
              </Stack>
            </Card>
          )}

          {schedule && schedule.subjectAssignments.length > 0 && (
            <Card withBorder p="md">
              <Title order={3} mb="md">
                Subject Assignments
              </Title>
              <Stack gap="sm">
                {schedule.subjectAssignments.map((assignment, index) => {
                  const classSectionName = classSectionMap.get(assignment.classSectionId) || assignment.classSectionId;
                  return (
                    <Group key={`${assignment.subjectId}-${assignment.classSectionId}-${index}`} justify="space-between">
                      <Text>
                        {assignment.subjectName} - {classSectionName}
                      </Text>
                      <Badge variant="light" color={colors.info}>
                        Subject Teacher
                      </Badge>
                    </Group>
                  );
                })}
              </Stack>
            </Card>
          )}

          {schedule &&
            schedule.classTeacherOf.length === 0 &&
            schedule.subjectAssignments.length === 0 && (
              <Card withBorder p="md">
                <Text c="dimmed" ta="center">
                  No assignments found for this teacher.
                </Text>
              </Card>
            )}
        </Stack>
      </div>
    </>
  );
}

