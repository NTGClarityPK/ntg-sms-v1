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
  Table,
  Badge,
  Alert,
  Button,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconUser, IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useMyStudent, useStudents } from '@/hooks/useStudents';
import { useLeaveRequests, useStudentLeaveStats, useLeaveQuota } from '@/hooks/useLeaveRequests';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useSchoolDays, usePublicHolidays, useVacations } from '@/hooks/useScheduleSettings';
import { LeaveRequestForm } from '@/components/features/leaves/LeaveRequestForm';
import { LeaveRequestTable } from '@/components/features/leaves/LeaveRequestTable';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth';
import type { Student } from '@/types/students';
import { useFeaturePermission } from '@/hooks/usePermissions';

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
  const t = useTranslations('leave');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const isStudent = user?.roles?.some((r) => r.roleName === 'student');
  const { canEdit } = useFeaturePermission('leaves');
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
      // Backend returns { data: ParentChild[] }
      // apiClient.get() returns ApiResponse<ParentChild[]> = { data: ParentChild[], meta?, error? }
      // So response.data is ParentChild[]
      return response.data || [];
    },
    enabled: !!userId && !!isParent,
  });

  // Extract children array from response
  const children = Array.isArray(childrenData) ? childrenData : [];
  
  // For parents: create minimal Student objects from children data
  // For staff: fetch all students
  const { data: studentsData, isLoading: isLoadingStudents } = useStudents({
    page: 1,
    limit: 100,
  });
  const myStudentQuery = useMyStudent();

  // For parents: create Student objects from children (form only needs id)
  // For students: use their own student record only
  // For staff: use all students from API
  let availableStudents: Student[] = [];
  if (isParent && children.length > 0) {
    // Create minimal Student objects from children data
    // The form only needs student.id (the UUID), so this is sufficient
    availableStudents = children.map(
      (c) =>
        ({
          id: c.studentId,
          userId: '',
          branchId: '',
          studentId: c.studentStudentId || '',
          isActive: true,
          accountStatus: 'active' as const,
          createdAt: c.createdAt,
          updatedAt: c.createdAt,
          firstName: (c as { firstName?: string }).firstName ?? (c.studentName?.split(' ')[0] ?? ''),
          lastName: (c as { lastName?: string }).lastName ?? (c.studentName?.split(' ').slice(1).join(' ') ?? ''),
        }) satisfies Student,
    );
  } else if (isStudent) {
    const myStudent = myStudentQuery.data?.data ?? null;
    availableStudents = myStudent ? [myStudent] : [];
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
  
  const isLoading =
    isLoadingChildren ||
    (isParent ? false : isStudent ? myStudentQuery.isLoading : isLoadingStudents);

  // Fetch student leave statistics
  const studentStats = useStudentLeaveStats(selectedStudentId);
  
  // Fetch quota for selected student to check if exceeded
  const quotaQuery = useLeaveQuota(selectedStudentId);
  const isQuotaExceeded = quotaQuery.data 
    ? quotaQuery.data.usedDays > quotaQuery.data.totalQuota 
    : false;

  const leaveQuery = useLeaveRequests({
    page,
    limit: 20,
    studentId: isParent || isStudent ? (selectedStudentId ?? undefined) : undefined,
  });
  const schoolDaysQuery = useSchoolDays();
  const activeSchoolDays = schoolDaysQuery.data?.data ?? [];

  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;
  const holidaysQuery = usePublicHolidays(activeYearId);
  const vacationsQuery = useVacations(activeYearId);

  const excludedDates =
    activeYearId && !holidaysQuery.isLoading && !vacationsQuery.isLoading
      ? (() => {
          const set = new Set<string>();
          const addRange = (start: string, end: string) => {
            const startD = new Date(start + 'T12:00:00');
            const endD = new Date(end + 'T12:00:00');
            const cur = new Date(startD.getTime());
            while (cur <= endD) {
              const y = cur.getFullYear();
              const m = String(cur.getMonth() + 1).padStart(2, '0');
              const d = String(cur.getDate()).padStart(2, '0');
              set.add(`${y}-${m}-${d}`);
              cur.setDate(cur.getDate() + 1);
            }
          };
          (holidaysQuery.data?.data ?? []).forEach((h: { startDate: string; endDate: string }) => addRange(h.startDate, h.endDate));
          (vacationsQuery.data?.data ?? []).forEach((v: { startDate: string; endDate: string }) => addRange(v.startDate, v.endDate));
          return set;
        })()
      : undefined;

  const requests = leaveQuery.data?.data ?? [];

  // Create a map of studentId -> student name for display in cards
  const studentNameMap = new Map<string, string>();
  availableStudents.forEach((student) => {
    if (student.id && (student.firstName || student.lastName)) {
      studentNameMap.set(student.id, `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim());
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
              loading={leaveQuery.isRefetching}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['leaves'] })}
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
          value={activeTab ?? ((isParent || isStudent) ? 'my-requests' : 'all-requests')}
          onChange={(value) => {
            setActiveTab(value);
            if (value === 'all-requests') {
              leaveQuery.refetch();
            }
          }}
        >
          <Tabs.List>
            {(isParent || isStudent) && (
              <Tabs.Tab id="leaves-tab-my-requests" value="my-requests">
                {t('tabRaiseRequest')}
              </Tabs.Tab>
            )}
            <Tabs.Tab id="leaves-tab-all-requests" value="all-requests">{t('tabAllRequests')}</Tabs.Tab>
          </Tabs.List>

          {(isParent || isStudent) && (
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
                ) : !canEdit ? (
                  <Alert color="blue" title={t('viewOnly')}>
                    <Text size="sm">{t('viewOnlyMessage')}</Text>
                  </Alert>
                ) : availableStudents.length > 0 ? (
                  <>
                    {availableStudents.length > 1 && (
                      <Paper withBorder p="md">
                        <Stack gap="sm">
                          <Select
                            id="leaves-select-student"
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
                              {quotaQuery.data && isQuotaExceeded && (
                                <Alert color="red" title={t('leaveQuotaExceeded')}>
                                  <Stack gap={4}>
                                    <Text size="sm">
                                      {t('leaveQuotaUsedLimit', { used: quotaQuery.data.usedDays, total: quotaQuery.data.totalQuota })}
                                    </Text>
                                    {(quotaQuery.data.daysFromAbsences ?? 0) > 0 && (
                                      <Text size="xs" c="dimmed">
                                        {t('daysFromAbsences', {
                                          count: quotaQuery.data.daysFromAbsences ?? 0,
                                        })}
                                      </Text>
                                    )}
                                  </Stack>
                                </Alert>
                              )}
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
                        {quotaQuery.data && isQuotaExceeded && (
                          <Alert color="red" title={t('leaveQuotaExceeded')}>
                            <Stack gap={4}>
                              <Text size="sm">
                                {t('leaveQuotaUsedLimit', { used: quotaQuery.data.usedDays, total: quotaQuery.data.totalQuota })}
                              </Text>
                              {(quotaQuery.data.daysFromAbsences ?? 0) > 0 && (
                                <Text size="xs" c="dimmed">
                                  {t('daysFromAbsences', {
                                    count: quotaQuery.data.daysFromAbsences ?? 0,
                                  })}
                                </Text>
                              )}
                            </Stack>
                          </Alert>
                        )}
                      </Stack>
                    )}
                    <Card withBorder p="md">
                      <Stack gap="sm">
                        <Title order={3}>{t('requestLeave')}</Title>
                        <LeaveRequestForm
                          key={selectedStudent?.id || 'no-student'}
                          student={selectedStudent}
                          onSuccess={() => setActiveTab('all-requests')}
                        />
                      </Stack>
                    </Card>
                  </>
                ) : (
                  <Card withBorder p="md">
                    <Text size="sm" c="dimmed">
                      {t('noStudentForAccount')} {children.length > 0 ? t('foundLinkedNoMatch', { count: children.length }) : t('noChildrenLinked')}
                    </Text>
                  </Card>
                )}
              </Stack>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="all-requests" pt="md">
            <Stack gap="md">
              {leaveQuery.isLoading || leaveQuery.isRefetching ? (
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('dateRequested')}</Table.Th>
                      <Table.Th>{t('leavePeriod')}</Table.Th>
                      <Table.Th>{t('student')}</Table.Th>
                      <Table.Th>{t('reason')}</Table.Th>
                      <Table.Th>{t('status')}</Table.Th>
                      <Table.Th>{t('reviewedBy')}</Table.Th>
                      <Table.Th>{t('dateReviewed')}</Table.Th>
                      <Table.Th>{t('reviewNotes')}</Table.Th>
                      <Table.Th>{t('actions')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Table.Tr key={i}>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} width={60} /></Table.Td>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} /></Table.Td>
                        <Table.Td><Skeleton height={20} width={100} /></Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : leaveQuery.isError ? (
                <Text size="sm" c="red">
                  {t('errorLoadingLeaveRequests')}
                </Text>
              ) : requests.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('noLeaveRequestsFoundShort')}
                </Text>
              ) : (
                <LeaveRequestTable
                  requests={requests}
                  meta={leaveQuery.data?.meta}
                  onPageChange={setPage}
                  isStaffView={!(isParent || isStudent)}
                  canEdit={canEdit}
                  studentNameMap={studentNameMap}
                  activeSchoolDays={activeSchoolDays}
                  excludedDates={excludedDates}
                />
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}


