'use client';

import { Alert, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { IconAlertCircle, IconSchool } from '@tabler/icons-react';
import { useStudentSelf } from '@/hooks/useStudentSelf';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function StudentDashboardPage() {
  const { data, isLoading, error } = useStudentSelf();
  const colors = useThemeColors();

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Student dashboard</Title>
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
        {isLoading ? (
          <Stack gap="md">
            <Skeleton height={80} />
            <Skeleton height={120} />
          </Stack>
        ) : error ? (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color={colors.error}
            title="Failed to load student details"
          >
            <Text size="sm">Please try again.</Text>
          </Alert>
        ) : !data ? (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color={colors.info}
            title="No student record found"
          >
            <Text size="sm">
              We could not find a student record for this login. Please contact your school
              administrator.
            </Text>
          </Alert>
        ) : (
          <Stack gap="md">
            <Alert
              icon={<IconSchool size={18} />}
              color={colors.primary}
              variant="light"
              radius="md"
            >
              <Text fw={600} size="lg">
                {data.firstName} {data.lastName}
              </Text>
              <Text size="sm" c="dimmed">
                Roll number: {data.studentId}
              </Text>
              <Text size="sm" c="dimmed">
                Class:{' '}
                {data.className && data.sectionName
                  ? `${data.className} - ${data.sectionName}`
                  : 'Not assigned'}
              </Text>
            </Alert>
          </Stack>
        )}
      </div>
    </>
  );
}

