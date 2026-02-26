'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  Group,
  Stack,
  Title,
  Tabs,
  Text,
  Select,
  Paper,
  Skeleton,
  Badge,
  Button,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconUser, IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useEarlyDepartures, useStudentEarlyDepartureStats, useEarlyDepartureStatistics } from '@/hooks/useEarlyDepartures';
import { EarlyDepartureForm } from '@/components/features/early-departure/EarlyDepartureForm';
import { AuthorizeEarlyDepartureForm } from '@/components/features/early-departure/AuthorizeEarlyDepartureForm';
import { EarlyDepartureTable } from '@/components/features/early-departure/EarlyDepartureTable';
import { EarlyDepartureStatistics } from '@/components/features/early-departure/EarlyDepartureStatistics';
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
  const t = useTranslations('earlyDeparture');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const [page, setPage] = useState(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  // For parents, fetch their children; for staff, fetch all students
  const userId = (user as User | undefined)?.id;
  const { data: childrenData, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['parent-children', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.get<ParentChild[]>(
        `/api/v1/parents/${userId}/children`,
      );
      return response.data || [];
    },
    enabled: !!userId && !!isParent,
  });

  // Extract children array from response
  // apiClient.get returns ApiResponse<T> which is { data: T, meta?, error? }
  // Backend returns { data: ParentChild[] }, so response.data is ParentChild[]
  const children = Array.isArray(childrenData) ? childrenData : [];
  
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
      id: c.studentId,
      userId: '',
      branchId: '',
      studentId: c.studentStudentId || '',
      isActive: true,
      createdAt: c.createdAt,
      updatedAt: c.createdAt,
      firstName: (c as { firstName?: string }).firstName ?? (c.studentName?.split(' ')[0] ?? ''),
      lastName: (c as { lastName?: string }).lastName ?? (c.studentName?.split(' ').slice(1).join(' ') ?? ''),
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

  // Fetch student early departure statistics
  const studentStats = useStudentEarlyDepartureStats(selectedStudentId);

  const requestsQuery = useEarlyDepartures({
    page,
    limit: 20,
  });

  const requests = requestsQuery.data?.data ?? [];
  const statisticsQuery = useEarlyDepartureStatistics();

  // Create a map of studentId -> student name for display in table
  const studentNameMap = new Map<string, string>();
  availableStudents.forEach((student) => {
    if (student.id && (student.firstName || student.lastName)) {
      studentNameMap.set(student.id, `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim());
    }
  });

  // Also add students from the requests if they're not in availableStudents
  requests.forEach((request) => {
    if (!studentNameMap.has(request.studentId)) {
      // Try to get from studentsData
      const student = studentsData?.data?.find((s) => s.id === request.studentId);
      if (student && (student.firstName || student.lastName)) {
        studentNameMap.set(request.studentId, `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim());
      }
    }
  });

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
          <Tooltip label={t('refresh')}>
            <ActionIcon
              variant="light"
              size="lg"
              loading={requestsQuery.isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['early-departures'] })}
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
        <Tabs
          value={activeTab ?? (isParent ? 'my-requests' : 'authorize')}
          onChange={(value) => {
            setActiveTab(value);
            if (value === 'all-requests') {
              requestsQuery.refetch();
            } else if (value === 'statistics') {
              statisticsQuery.refetch();
            }
          }}
        >
          <Tabs.List>
            {isParent && <Tabs.Tab id="early-departure-tab-my-requests" value="my-requests">{t('tabRaiseRequest')}</Tabs.Tab>}
            {!isParent && <Tabs.Tab id="early-departure-tab-authorize" value="authorize">{t('tabAuthorize')}</Tabs.Tab>}
            <Tabs.Tab id="early-departure-tab-all-requests" value="all-requests">{t('tabAllRequests')}</Tabs.Tab>
            <Tabs.Tab id="early-departure-tab-statistics" value="statistics">{t('tabStatistics')}</Tabs.Tab>
          </Tabs.List>

          {isParent && (
            <Tabs.Panel value="my-requests" pt="md">
              <Stack gap="md">
                {isLoading ? (
                  <Stack gap="md">
                    <Paper withBorder p="md">
                      <Skeleton height={40} width="30%" />
                      <Skeleton height={20} width="60%" mt="md" />
                    </Paper>
                    <Card withBorder p="md">
                      <Stack gap="md">
                        <Skeleton height={30} width="40%" />
                        <Skeleton height={40} />
                        <Skeleton height={40} />
                        <Skeleton height={100} />
                        <Skeleton height={40} width="30%" />
                      </Stack>
                    </Card>
                  </Stack>
                ) : availableStudents.length > 0 ? (
                  <>
                    {availableStudents.length > 1 && (
                      <Paper withBorder p="md">
                        <Stack gap="sm">
                          <Select
                            id="early-departure-select-student"
                            label={t('selectStudent')}
                            placeholder={t('chooseStudent')}
                            data={availableStudents.map((s) => ({
                              value: s.id,
                              label: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.studentId || `Student ${s.id.slice(0, 8)}`,
                            }))}
                            value={selectedStudentId}
                            onChange={(value) => setSelectedStudentId(value)}
                            leftSection={<IconUser size={16} />}
                          />
                          {selectedStudentId && (
                            <Stack gap="xs" mt="xs">
                              <Group gap="md">
                                {studentStats.isLoading ? (
                                  <Skeleton height={20} width={100} />
                                ) : studentStats.data ? (
                                  <>
                                    <Group gap="xs">
                                      <Text size="sm" c="dimmed">
                                        {t('pending')}:
                                      </Text>
                                      <Badge variant="light" color="yellow" size="sm">
                                        {studentStats.data.pending}
                                      </Badge>
                                    </Group>
                                    <Group gap="xs">
                                      <Text size="sm" c="dimmed">
                                        {t('approved')}:
                                      </Text>
                                      <Badge variant="light" color="green" size="sm">
                                        {studentStats.data.approved}
                                      </Badge>
                                    </Group>
                                    <Group gap="xs">
                                      <Text size="sm" c="dimmed">
                                        {t('rejected')}:
                                      </Text>
                                      <Badge variant="light" color="red" size="sm">
                                        {studentStats.data.rejected}
                                      </Badge>
                                    </Group>
                                  </>
                                ) : null}
                              </Group>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    )}
                    {availableStudents.length === 1 && selectedStudentId && (
                      <Stack gap="xs">
                        <Paper withBorder p="md">
                          {studentStats.isLoading ? (
                            <Skeleton height={20} width={200} />
                          ) : studentStats.data ? (
                            <Group gap="md">
                              <Group gap="xs">
                                <Text size="sm" c="dimmed">
                                  {t('pendingRequests')}
                                </Text>
                                <Badge variant="light" color="yellow" size="sm">
                                  {studentStats.data.pending}
                                </Badge>
                              </Group>
                              <Group gap="xs">
                                <Text size="sm" c="dimmed">
                                  {t('approvedRequests')}
                                </Text>
                                <Badge variant="light" color="green" size="sm">
                                  {studentStats.data.approved}
                                </Badge>
                              </Group>
                              <Group gap="xs">
                                <Text size="sm" c="dimmed">
                                  {t('rejectedRequests')}
                                </Text>
                                <Badge variant="light" color="red" size="sm">
                                  {studentStats.data.rejected}
                                </Badge>
                              </Group>
                            </Group>
                          ) : null}
                        </Paper>
                      </Stack>
                    )}
                    <Card withBorder p="md">
                      <Stack gap="sm">
                        <Title order={3}>{t('requestEarlyDeparture')}</Title>
                        <EarlyDepartureForm
                          student={selectedStudent}
                          onSuccess={() => setActiveTab('all-requests')}
                        />
                      </Stack>
                    </Card>
                  </>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t('noStudentForAccount')} {children.length > 0 ? t('foundLinkedNoMatch', { count: children.length }) : t('noChildrenLinked')}
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>
          )}

          {!isParent && (
            <Tabs.Panel value="authorize" pt="md">
              <Stack gap="md">
                <Card withBorder p="md">
                  <AuthorizeEarlyDepartureForm
                    onSuccess={() => {
                      setActiveTab('all-requests');
                      requestsQuery.refetch();
                      statisticsQuery.refetch();
                    }}
                  />
                </Card>
              </Stack>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="all-requests" pt="md">
            <Stack gap="md">
              {requestsQuery.isLoading || requestsQuery.isRefetching ? (
                <Stack gap="md">
                  <Skeleton height={40} width="30%" />
                  <Skeleton height={400} />
                  <Skeleton height={50} />
                </Stack>
              ) : requestsQuery.error ? (
                <Text size="sm" c="dimmed">
                  {t('failedToLoadRequests')}
                </Text>
              ) : requests.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('noEarlyDepartureRequestsShort')}
                </Text>
              ) : (
                <EarlyDepartureTable
                  requests={requests}
                  meta={requestsQuery.data?.meta}
                  onPageChange={setPage}
                  isStaffView={!isParent}
                  studentNameMap={studentNameMap}
                />
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="statistics" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600} size="lg">{t('statisticsTitle')}</Text>
                  <Text size="sm" c="dimmed">
                    {isParent
                      ? t('statisticsForYourStudents')
                      : t('statisticsForAllStudents')}
                  </Text>
                </Stack>
              </Paper>
              <EarlyDepartureStatistics
                statistics={statisticsQuery.data ?? []}
                isLoading={statisticsQuery.isLoading}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
