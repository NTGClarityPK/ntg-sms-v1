'use client';

import { Title, Skeleton, Text, Stack, Card, Group, Badge, Alert, Button } from '@mantine/core';
import { useStaffSchedule } from '@/hooks/useStaffSchedule';
import { useMyStaff } from '@/hooks/useStaff';
import { useClassSections } from '@/hooks/useClassSections';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { useMemo } from 'react';
import { IconRefresh } from '@tabler/icons-react';

export default function MySchedulePage() {
  const { data: myStaffData, isLoading: isLoadingStaff, error: staffError } = useMyStaff();
  const myStaff = myStaffData?.data || null;
  const staffId = myStaff?.id || null;
  const { data: scheduleData, isLoading: isLoadingSchedule, error, refetch } = useStaffSchedule(staffId);
  const { data: classSectionsData } = useClassSections();
  const colors = useThemeColors();

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

  if (isLoadingStaff || isLoadingSchedule) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>My Schedule</Title>
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
            <Skeleton height={40} width="30%" />
            <Skeleton height={200} />
            <Skeleton height={200} />
          </Stack>
        </div>
      </>
    );
  }

  if (!myStaff) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>My Schedule</Title>
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
          <Alert color={colors.info} title="No Staff Record Found">
            <Text size="sm">
              You don't have a staff record in the system. Please contact your administrator.
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-title-bar">
          <Title order={1}>My Schedule</Title>
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
          <Alert color={colors.error} title="Error loading schedule">
            <Group justify="space-between" mt="sm">
              <Text size="sm">
                {error instanceof Error ? error.message : 'Unknown error'}
              </Text>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </Group>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Title order={1}>My Schedule</Title>
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
                  No assignments found. You haven't been assigned to any classes or subjects yet.
                </Text>
              </Card>
            )}
        </Stack>
      </div>
    </>
  );
}

