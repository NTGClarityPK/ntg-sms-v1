'use client';

import { Container, Title, Stack, Card, Text, Button, Group, Loader, Alert } from '@mantine/core';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import type { User } from '@/types/auth';

interface Child {
  id: string;
  studentId: string;
  studentName?: string;
}

export default function SelectChildPage() {
  const { user } = useAuth();
  const router = useRouter();

  const userId = (user as User | undefined)?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-children', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await apiClient.get<{ data: Child[] }>(`/api/v1/parents/${userId}/children`);
      return response.data;
    },
    enabled: !!userId,
  });

  const selectChild = useMutation({
    mutationFn: async (studentId: string) => {
      await apiClient.post('/auth/select-child', { studentId });
    },
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Child selected successfully',
        color: 'green',
      });
      router.push('/dashboard');
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to select child',
        color: 'red',
      });
    },
  });

  if (isLoading) {
    return (
      <Container size="sm" py="xl">
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  if (error || !data?.data || data.data.length === 0) {
    return (
      <Container size="sm" py="xl">
        <Alert color="red" title="No children found">
          <Text size="sm">Please contact the school administrator to link your children.</Text>
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="md">
        <Title order={1}>Select Child</Title>
        <Text c="dimmed">Please select which child you want to view information for.</Text>

        <Stack gap="md">
          {data.data.map((child) => (
            <Card key={child.id} padding="lg" withBorder>
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{child.studentName || 'Student'}</Text>
                  <Text size="sm" c="dimmed">
                    ID: {child.studentId}
                  </Text>
                </div>
                <Button
                  onClick={() => selectChild.mutate(child.id)}
                  loading={selectChild.isPending}
                >
                  Select
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}

