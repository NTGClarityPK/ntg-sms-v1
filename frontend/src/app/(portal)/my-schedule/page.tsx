'use client';

import { Title, Skeleton, Text, Stack, Alert, Button, Group, Tooltip, ActionIcon } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useMyTimetable } from '@/hooks/useTimetable';
import { useMyStaff } from '@/hooks/useStaff';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { TeacherWeekView } from '@/components/features/timetable/TeacherWeekView';
import { IconRefresh } from '@tabler/icons-react';

export default function MySchedulePage() {
  const queryClient = useQueryClient();
  const { data: myStaffData, isLoading: isLoadingStaff } = useMyStaff();
  const myStaff = myStaffData?.data || null;
  const { data: timetableData, isLoading: isLoadingTimetable, error, refetch, isRefetching } = useMyTimetable();
  const colors = useThemeColors();

  // CRITICAL: Hook returns full response object, component accesses timetableData?.data
  const timetable = timetableData?.data;

  // Show page structure immediately, handle loading/error states inline
  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>My Schedule</Title>
          <Tooltip label="Refresh">
            <ActionIcon
              variant="light"
              size="lg"
              loading={isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['timetable'] })}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
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
        {isLoadingStaff || !myStaffData ? (
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        ) : !myStaff ? (
          <Alert color={colors.info} title="No Staff Record Found">
            <Text size="sm">
              You don't have a staff record in the system. Please contact your administrator.
            </Text>
          </Alert>
        ) : error ? (
          <Alert color={colors.error} title="Error loading timetable">
            <Text size="sm" mb="sm">
              {error instanceof Error ? error.message : 'Unknown error'}
            </Text>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </Alert>
        ) : isLoadingTimetable || isRefetching || !timetableData ? (
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        ) : !timetable || timetable.slots.length === 0 ? (
          <Alert color={colors.info} title="No Timetable Slots">
            <Text size="sm">
              You don't have any timetable slots assigned yet. Please contact your administrator.
            </Text>
          </Alert>
        ) : (
          <TeacherWeekView
            staffId={timetable.staffId}
            slots={timetable.slots}
            freePeriods={timetable.freePeriods}
            isLoading={isLoadingTimetable}
          />
        )}
      </div>
    </>
  );
}
