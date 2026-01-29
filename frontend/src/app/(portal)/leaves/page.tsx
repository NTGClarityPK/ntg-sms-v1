'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Group,
  Stack,
  Title,
  Tabs,
  SimpleGrid,
  Text,
  Select,
  Paper,
} from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { LeaveRequestForm } from '@/components/features/leaves/LeaveRequestForm';
import { LeaveRequestCard } from '@/components/features/leaves/LeaveRequestCard';
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

export default function LeavesPage() {
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const [page] = useState(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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
  
  // For parents: create minimal Student objects from children data
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

  // Set default selected student when students load
  useEffect(() => {
    if (availableStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(availableStudents[0].id);
    }
  }, [availableStudents, selectedStudentId]);

  const selectedStudent = availableStudents.find((s) => s.id === selectedStudentId) ?? availableStudents[0] ?? null;
  
  const isLoading = isLoadingChildren || (isParent ? false : isLoadingStudents);

  const leaveQuery = useLeaveRequests({
    page,
    limit: 20,
  });

  const requests = leaveQuery.data?.data ?? [];

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Leaves</Title>
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
            {isParent && <Tabs.Tab value="my-requests">My requests</Tabs.Tab>}
            <Tabs.Tab value="all-requests">All requests</Tabs.Tab>
          </Tabs.List>

          {isParent && (
            <Tabs.Panel value="my-requests" pt="md">
              <Stack gap="md">
                {isLoading ? (
                  <Card withBorder p="md">
                    <Text size="sm" c="dimmed">
                      Loading students...
                    </Text>
                  </Card>
                ) : availableStudents.length > 0 ? (
                  <>
                    {availableStudents.length > 1 && (
                      <Paper withBorder p="md">
                        <Select
                          label="Select Student"
                          placeholder="Choose a student"
                          data={availableStudents.map((s) => ({
                            value: s.id,
                            label: s.fullName || s.studentId || `Student ${s.id.slice(0, 8)}`,
                          }))}
                          value={selectedStudentId}
                          onChange={(value) => setSelectedStudentId(value)}
                          leftSection={<IconUser size={16} />}
                        />
                      </Paper>
                    )}
                    <Card withBorder p="md">
                      <Stack gap="sm">
                        <Title order={3}>Request leave</Title>
                        <LeaveRequestForm student={selectedStudent} />
                      </Stack>
                    </Card>
                  </>
                ) : (
                  <Card withBorder p="md">
                    <Text size="sm" c="dimmed">
                      No student found for your account. {children.length > 0 ? `Found ${children.length} linked children, but no matching students.` : 'No children linked to your account.'}
                    </Text>
                  </Card>
                )}
              </Stack>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="all-requests" pt="md">
            <Stack gap="md">
              {requests.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No leave requests found.
                </Text>
              ) : (
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  {requests.map((r) => (
                    <LeaveRequestCard
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


