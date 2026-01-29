'use client';

import { useState } from 'react';
import {
  Card,
  Group,
  Stack,
  Title,
  Tabs,
  SimpleGrid,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useEarlyDepartures } from '@/hooks/useEarlyDepartures';
import { EarlyDepartureForm } from '@/components/features/early-departure/EarlyDepartureForm';
import { EarlyDepartureCard } from '@/components/features/early-departure/EarlyDepartureCard';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth';
import type { Student } from '@/types/students';

interface ParentChild {
  id: string; // parent_student association ID
  parentUserId: string;
  studentId: string; // student UUID
  relationship: 'father' | 'mother' | 'guardian';
  isPrimary: boolean;
  canApprove: boolean;
  createdAt: string;
  parentName?: string;
  studentName?: string;
  studentStudentId?: string; // student's student_id field (e.g., "ST001")
}

export default function EarlyDeparturePage() {
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const [page] = useState(1);

  // For parents, fetch their children; for staff, fetch all students
  const userId = (user as User | undefined)?.id;
  const { data: childrenData, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['parent-children', userId],
    queryFn: async () => {
      if (!userId || !isParent) return null;
      const response = await apiClient.get<{ data: ParentChild[] }>(
        `/api/v1/parents/${userId}/children`,
      );
      // apiClient.get returns { data: [...] }, so response.data is the array
      return response.data;
    },
    enabled: !!userId && !!isParent,
  });

  // childrenData is already the array (ParentChild[]), not { data: [...] }
  const children = childrenData || [];
  
  // For parents: create Student objects from children data
  // For staff: fetch all students
  const { data: studentsData, isLoading: isLoadingStudents } = useStudents({
    page: 1,
    limit: 100,
  });

  // For parents: create Student objects from children (form only needs id)
  // For staff: use all students from API
  let availableStudents: Student[] = [];
  if (isParent && children.length > 0) {
    // Create minimal Student objects from children data
    // The form only needs student.id (the UUID), so this is sufficient
    availableStudents = children.map((c) => ({
      id: c.studentId, // This is the student UUID, which is what we need
      userId: '',
      branchId: '',
      studentId: c.studentStudentId || '', // student's student_id (e.g., "ST001")
      isActive: true,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      fullName: c.studentName,
    } as Student));
  } else if (!isParent && studentsData?.data) {
    availableStudents = studentsData.data;
  }

  const firstStudent = availableStudents[0] ?? null;
  
  const isLoading = isLoadingChildren || (isParent ? false : isLoadingStudents);

  const requestsQuery = useEarlyDepartures({
    page,
    limit: 20,
  });

  const requests = requestsQuery.data?.data ?? [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Early Departure</Title>
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
        <Tabs defaultValue={isParent ? 'my-requests' : 'all-requests'}>
          <Tabs.List>
            {isParent && (
              <Tabs.Tab value="my-requests">My requests</Tabs.Tab>
            )}
            <Tabs.Tab value="all-requests">All requests</Tabs.Tab>
          </Tabs.List>

          {isParent && (
            <Tabs.Panel value="my-requests" pt="md">
              <Stack gap="md">
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Title order={3}>Request early departure</Title>
                    {isLoading ? (
                      <Text size="sm" c="dimmed">
                        Loading students...
                      </Text>
                    ) : firstStudent ? (
                      <EarlyDepartureForm student={firstStudent} />
                    ) : (
                      <Text size="sm" c="dimmed">
                        No student found for your account. {children.length > 0 ? `Found ${children.length} linked children, but no matching students.` : 'No children linked to your account.'}
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="all-requests" pt="md">
            <Stack gap="md">
              {requests.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No early departure requests found.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  {requests.map((r) => (
                    <EarlyDepartureCard
                      key={r.id}
                      request={r}
                      isStaffView={!isParent}
                    />
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}


