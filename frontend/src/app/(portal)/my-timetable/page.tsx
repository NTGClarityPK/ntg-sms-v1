'use client';

import { Title, Text, Stack, Skeleton, Group, Alert, Paper } from '@mantine/core';
import { useStudentTimetable, useTimingTemplateInfo } from '@/hooks/useTimetable';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import { useStudentTemplate } from '@/hooks/useSubjectTemplates';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import { TimetableGrid } from '@/components/features/timetable/TimetableGrid';
import { TemplateInfoBanner } from '@/components/features/timetable/TemplateInfoBanner';
import { useMyStudent } from '@/hooks/useStudents';
import { useClassSections } from '@/hooks/useClassSections';

export default function MyTimetablePage() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const branchId = user?.currentBranch?.id;
  const { data: activeYear } = useActiveAcademicYear();
  const activeYearId = activeYear?.data?.id;

  // Get current student
  const { data: myStudentData, isLoading: myStudentLoading, error: myStudentError } = useMyStudent();
  console.log('[MyTimetablePage] myStudentData:', myStudentData);
  console.log('[MyTimetablePage] myStudentLoading:', myStudentLoading);
  console.log('[MyTimetablePage] myStudentError:', myStudentError);
  const studentId = myStudentData?.data?.id;

  // Get student's template assignment
  const { data: templateData, isLoading: templateLoading } = useStudentTemplate(
    studentId ?? null,
    activeYearId ?? null,
    branchId ?? null,
  );

  // Get class-section ID from student's classId and sectionId
  const { data: classSectionsData, isLoading: classSectionsLoading } = useClassSections(
    myStudentData?.data?.classId && myStudentData?.data?.sectionId && activeYearId
      ? {
          classId: myStudentData.data.classId,
          sectionId: myStudentData.data.sectionId,
          academicYearId: activeYearId,
        }
      : undefined,
  );
  const classSectionId = classSectionsData?.data?.[0]?.id;

  // Get timetable filtered by template
  const { data: timetableData, isLoading: timetableLoading, error: timetableError } =
    useStudentTimetable(studentId ?? null, activeYearId);

  // Get timing template info for banner
  const { data: templateInfoData, isLoading: templateInfoLoading } = useTimingTemplateInfo(classSectionId ?? null);

  const timetable = timetableData?.data;
  // Use template info from student data if available, otherwise from separate query
  const subjectTemplate = myStudentData?.data?.subjectTemplateId
    ? {
        id: myStudentData.data.subjectTemplateId,
        name: myStudentData.data.subjectTemplateName || 'Unknown Template',
      }
    : templateData?.data;
  const templateInfo = templateInfoData;
  
  console.log('[MyTimetablePage] subjectTemplate:', subjectTemplate);
  console.log('[MyTimetablePage] myStudentData.data.subjectTemplateId:', myStudentData?.data?.subjectTemplateId);

  // Loading state - only check isLoading flags, not data existence
  if (myStudentLoading || timetableLoading || classSectionsLoading || templateInfoLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>My Timetable</Title>
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
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        </div>
      </>
    );
  }

  // Check if student data is available
  if (!myStudentData?.data) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>My Timetable</Title>
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
          <Alert color={colors.warning} title="Student Not Found">
            <Text size="sm">
              Unable to retrieve your student information. Please contact your administrator.
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  // Error or no template assigned
  if (timetableError || !subjectTemplate) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>My Timetable</Title>
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
          <Alert color={colors.warning} title="No Subject Template Assigned">
            <Text size="sm">
              No subject template has been assigned to you for this academic year. Please contact
              your administrator.
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  // No timetable data
  if (!timetable) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>My Timetable</Title>
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
          <Alert color={colors.info} title="No Timetable Available">
            <Text size="sm">No timetable has been created for your class-section yet.</Text>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>My Timetable</Title>
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
          {subjectTemplate && (
            <Paper p="md" withBorder>
              <Text size="sm" fw={500}>
                Subject Template: {subjectTemplate.name}
              </Text>
              {subjectTemplate.description && (
                <Text size="xs" c="dimmed" mt={4}>
                  {subjectTemplate.description}
                </Text>
              )}
            </Paper>
          )}

          <TemplateInfoBanner templateInfo={templateInfo || null} />

          {timetable && (
            <TimetableGrid
              classSectionId={classSectionId ?? ''}
              slots={timetable.slots}
              onSlotClick={() => {}} // Read-only for students
              templateInfo={templateInfo || null}
              conflicts={[]}
              isLoading={timetableLoading}
            />
          )}

          {timetable && timetable.slots.length === 0 && (
            <Alert color={colors.info} title="No Timetable Slots">
              <Text size="sm">
                No timetable slots have been created for your class-section yet.
              </Text>
            </Alert>
          )}
        </Stack>
      </div>
    </>
  );
}

