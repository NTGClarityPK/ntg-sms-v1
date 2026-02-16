'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconUser } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useStudentTimetable, useTimingTemplateInfo } from '@/hooks/useTimetable';
import { useStudentTemplate } from '@/hooks/useSubjectTemplates';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { apiClient } from '@/lib/api-client';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import type { User } from '@/types/auth';

interface Child {
  id: string;
  studentId: string;
  studentName?: string;
  studentStudentId?: string;
}

export default function ChildrenTimetablePage() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const userId = (user as User | undefined)?.id;
  const { data: activeYear } = useActiveAcademicYear();
  const activeYearId = activeYear?.data?.id;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const currentChildId = (
    user as (User & { currentStudentId?: string }) | undefined
  )?.currentStudentId;

  const { data: childrenData, isLoading: isLoadingChildren } = useQuery({
    queryKey: ['parent-children-timetable', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await apiClient.get<Child[]>(`/api/v1/parents/${userId}/children`);
      return response.data || [];
    },
    enabled: !!userId,
  });

  const children = Array.isArray(childrenData) ? childrenData : [];

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      if (currentChildId && children.some((child) => child.studentId === currentChildId)) {
        setSelectedChildId(currentChildId);
      } else {
        setSelectedChildId(children[0].studentId);
      }
    }
  }, [children, selectedChildId, currentChildId]);

  const { data: studentTemplateData, isLoading: isLoadingTemplateAssignment } = useStudentTemplate(
    selectedChildId,
    activeYearId ?? null,
    (user as User | undefined)?.currentBranch?.id ?? null,
  );
  const subjectTemplate = studentTemplateData?.data || null;

  const shouldLoadTimetable = !!selectedChildId && !!activeYearId && !!subjectTemplate;
  const { data: guardedTimetableData, isLoading: isLoadingGuardedTimetable } = useStudentTimetable(
    shouldLoadTimetable ? selectedChildId : null,
    activeYearId,
  );

  const timetable = guardedTimetableData?.data || null;
  const classSectionId =
    timetable?.classSectionId || timetable?.slots?.[0]?.classSectionId || null;

  const { data: templateInfo, isLoading: isLoadingTemplateInfo } =
    useTimingTemplateInfo(classSectionId);

  const selectedChild = children.find((child) => child.studentId === selectedChildId);

  const isLoading =
    isLoadingChildren ||
    (selectedChildId ? isLoadingTemplateAssignment : false) ||
    (shouldLoadTimetable ? isLoadingGuardedTimetable : false) ||
    isLoadingTemplateInfo;

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Child Timetable</Title>
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
          {isLoadingChildren ? (
            <Stack gap="md">
              <Skeleton height={40} />
              <Skeleton height={360} />
            </Stack>
          ) : children.length === 0 ? (
            <Alert icon={<IconAlertCircle size={16} />} color={colors.warning} title="No children linked">
              <Text size="sm">
                No children are linked to your account yet. Please contact the school administrator.
              </Text>
            </Alert>
          ) : (
            <>
              <Paper withBorder p="md">
                <Select
                  label="Select Child"
                  placeholder="Choose a child"
                  data={children.map((child) => ({
                    value: child.studentId,
                    label: child.studentName || child.studentStudentId || child.studentId,
                  }))}
                  value={selectedChildId}
                  onChange={(value) => setSelectedChildId(value)}
                  leftSection={<IconUser size={16} />}
                  searchable
                />
              </Paper>

              {selectedChild && (
                <Paper withBorder p="md">
                  <Stack gap={4}>
                    <Text size="sm">
                      Showing timetable for{' '}
                      <Text component="span" fw={600}>
                        {selectedChild.studentName || selectedChild.studentStudentId || selectedChild.studentId}
                      </Text>
                      .
                    </Text>
                    <Text size="sm" c="dimmed">
                      Subject Template Group:{' '}
                      <Text component="span" fw={600}>
                        {subjectTemplate?.name || 'Not assigned'}
                      </Text>
                    </Text>
                    <Text size="sm" c="dimmed">
                      Class Section:{' '}
                      <Text component="span" fw={600}>
                        {timetable ? `${timetable.className} - ${timetable.sectionName}` : 'Not available'}
                      </Text>
                    </Text>
                  </Stack>
                </Paper>
              )}

              {isLoading ? (
                <Skeleton height={420} />
              ) : !subjectTemplate ? (
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color={colors.warning}
                  title="No subject template assigned"
                >
                  <Text size="sm">
                    The selected child does not have a subject template assigned for the active academic year.
                  </Text>
                </Alert>
              ) : !timetable ? (
                <Alert icon={<IconAlertCircle size={16} />} color={colors.info} title="No timetable available">
                  <Text size="sm">No timetable has been created for the selected child yet.</Text>
                </Alert>
              ) : (
                <TimetableGrid
                  classSectionId={timetable.classSectionId}
                  slots={timetable.slots}
                  onSlotClick={() => undefined}
                  templateInfo={templateInfo || null}
                  conflicts={[]}
                  isLoading={false}
                />
              )}
            </>
          )}
        </Stack>
      </div>
    </>
  );
}

