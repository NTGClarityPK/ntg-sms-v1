'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconInfoCircle, IconUsersGroup } from '@tabler/icons-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { ChildResultCards } from '@/components/features/results/ChildResultCards';
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
  studentStudentId?: string;
}

export default function MyChildrenPage() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const userId = (user as User | undefined)?.id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-children', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.get<Child[]>(`/api/v1/parents/${userId}/children`);
      return response.data || [];
    },
    enabled: !!userId,
  });

  const children = Array.isArray(data) ? data : [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>My Child</Title>
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
          {isLoading ? (
            <Stack gap="md">
              <Skeleton height={120} />
              <Skeleton height={120} />
            </Stack>
          ) : error ? (
            <Alert icon={<IconAlertCircle size={16} />} color={colors.error} title="Failed to load children">
              <Group justify="space-between" mt="sm">
                <Text size="sm">Please try again.</Text>
                <Text
                  size="sm"
                  c={colors.primary}
                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => refetch()}
                >
                  Retry
                </Text>
              </Group>
            </Alert>
          ) : children.length === 0 ? (
            <Alert icon={<IconUsersGroup size={16} />} color={colors.info} title="No children linked">
              <Text size="sm">
                No children are linked to your account yet. Please contact the school administrator.
              </Text>
            </Alert>
          ) : (
            children.map((child) => (
              <Paper key={child.id} withBorder p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Text fw={600} size="lg">
                      {child.studentName || 'Student'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Student ID: {child.studentStudentId || child.studentId}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Relationship: {child.relationship}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <Tooltip
                      label={
                        child.canApprove
                          ? 'This linked parent can approve child-related requests (for example consent/approval workflows).'
                          : 'This linked parent can view child information but cannot approve child-related requests.'
                      }
                      position="top"
                      withArrow
                    >
                      <Badge
                        variant="light"
                        color={child.canApprove ? 'green' : 'gray'}
                        leftSection={<IconInfoCircle size={12} />}
                      >
                        {child.canApprove ? 'Approval Access' : 'No Approval Access'}
                      </Badge>
                    </Tooltip>
                  </Group>
                </Group>
                <Divider my="md" />
                <ChildResultCards studentId={child.studentId} />
              </Paper>
            ))
          )}
        </Stack>
      </div>
    </>
  );
}

