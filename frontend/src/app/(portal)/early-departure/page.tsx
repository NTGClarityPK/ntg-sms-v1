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
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconUser, IconRefresh } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useStudents } from '@/hooks/useStudents';
import { useStudentEarlyDepartureStats } from '@/hooks/useEarlyDepartures';
import { EarlyDepartureForm } from '@/components/features/early-departure/EarlyDepartureForm';
import { AuthorizeEarlyDepartureForm } from '@/components/features/early-departure/AuthorizeEarlyDepartureForm';
import { EarlyDepartureHistoryContent } from '@/components/features/early-departure/EarlyDepartureHistoryContent';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/types/auth';
import type { Student } from '@/types/students';
import { useFeaturePermission } from '@/hooks/usePermissions';

interface ParentChild {
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

export default function EarlyDeparturePage() {
  const t = useTranslations('earlyDeparture');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isParent = user?.roles?.some((r) => r.roleName === 'parent');
  const { canEdit } = useFeaturePermission('early_departure');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  /** All requests tab only; null = every linked child (no studentId query param). */
  const [historyScopeStudentId, setHistoryScopeStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('operational');

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

  const children = Array.isArray(childrenData) ? childrenData : [];

  const { data: studentsData, isLoading: isLoadingStudents } = useStudents({
    page: 1,
    limit: 100,
  });

  let availableStudents: Student[] = [];
  if (isParent && children.length > 0) {
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
  } else if (!isParent && studentsData?.data) {
    availableStudents = studentsData.data;
  }

  useEffect(() => {
    if (availableStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(availableStudents[0].id);
    }
  }, [availableStudents, selectedStudentId]);

  const selectedStudent =
    availableStudents.find((s) => s.id === selectedStudentId) ?? availableStudents[0] ?? null;

  const isLoading = isLoadingChildren || (isParent ? false : isLoadingStudents);

  const studentStats = useStudentEarlyDepartureStats(selectedStudentId);

  const studentNameMap = new Map<string, string>();
  availableStudents.forEach((student) => {
    if (student.id && (student.firstName || student.lastName)) {
      studentNameMap.set(student.id, `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim());
    }
  });

  const handleOperationalSuccess = () => {
    setActiveTab('all-requests');
    queryClient.invalidateQueries({ queryKey: ['early-departures'] });
  };

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>{t('title')}</Title>
          <Tooltip label={t('refresh')}>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ['early-departures'] })
              }
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
          value={activeTab ?? 'operational'}
          onChange={(v) => setActiveTab(v ?? 'operational')}
        >
          <Tabs.List>
            <Tabs.Tab id="early-departure-tab-operational" value="operational">
              {t('tabRaiseRequest')}
            </Tabs.Tab>
            <Tabs.Tab id="early-departure-tab-all-requests" value="all-requests">
              {t('tabAllRequests')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="operational" pt="md">
            <Stack gap="lg">
              {!isParent ? (
                <Card withBorder p="md">
                  <Stack gap="md">
                    <Title order={4}>{t('tabAuthorize')}</Title>
                    <AuthorizeEarlyDepartureForm onSuccess={handleOperationalSuccess} />
                  </Stack>
                </Card>
              ) : null}

              {isParent ? (
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
                                label:
                                  `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ||
                                  s.studentId ||
                                  `Student ${s.id.slice(0, 8)}`,
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
                      )}
                      <Card withBorder p="md">
                        <Stack gap="sm">
                          <Title order={3}>{t('requestEarlyDeparture')}</Title>
                          <EarlyDepartureForm
                            student={selectedStudent}
                            onSuccess={handleOperationalSuccess}
                          />
                        </Stack>
                      </Card>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {t('noStudentForAccount')}{' '}
                      {children.length > 0
                        ? t('foundLinkedNoMatch', { count: children.length })
                        : t('noChildrenLinked')}
                    </Text>
                  )}
                </Stack>
              ) : null}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="all-requests" pt="md">
            <EarlyDepartureHistoryContent
              isParent={!!isParent}
              canEdit={canEdit}
              studentNameMap={studentNameMap}
              scopedStudentId={historyScopeStudentId}
              onScopedStudentIdChange={
                isParent ? setHistoryScopeStudentId : undefined
              }
              scopedStudentSelectData={availableStudents.map((s) => ({
                value: s.id,
                label:
                  `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() ||
                  s.studentId ||
                  `Student ${s.id.slice(0, 8)}`,
              }))}
              showScopedStudentSelect={isParent && availableStudents.length > 0}
            />
          </Tabs.Panel>
        </Tabs>
      </div>
    </>
  );
}
