'use client';

import { useState } from 'react';
import { Button, Group, Stack, Text, Title, Skeleton, Alert, Tabs } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconRocket, IconCopy, IconShield, IconCalendar, IconSchool, IconClock, IconClipboardList, IconMessage, IconMoodHappy, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useSettingsStatus } from '@/hooks/useSettingsStatus';
import { useTenantBranches } from '@/hooks/useBranches';
import { SetupWizard } from '@/components/features/settings/SetupWizard';
import { CopySettingsModal } from '@/components/features/settings/CopySettingsModal';
import { useSaveSetupWizard } from '@/hooks/useSetupWizard';
import { useThemeColors, useNotificationColors } from '@/lib/hooks/use-theme-colors';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { notifications } from '@mantine/notifications';

// Import components for each tab
import { PermissionMatrix } from '@/components/features/settings/PermissionMatrix';
import { usePermissions } from '@/hooks/usePermissions';
import { useRoles, useFeatures } from '@/hooks/useRoles';

import { AcademicYearForm, type AcademicYearFormValues } from '@/components/features/settings/AcademicYearForm';
import { AcademicYearCard } from '@/components/features/settings/AcademicYearCard';
import { useAcademicYearsList, useActivateAcademicYear, useCreateAcademicYear, useLockAcademicYear } from '@/hooks/useAcademicYears';

import { SubjectList } from '@/components/features/settings/SubjectList';
import { ClassList } from '@/components/features/settings/ClassList';
import { SectionList } from '@/components/features/settings/SectionList';
import { LevelManager } from '@/components/features/settings/LevelManager';

import { SchoolDaysSelector } from '@/components/features/settings/SchoolDaysSelector';
import { TimingTemplateForm, type TimingTemplateFormValues } from '@/components/features/settings/TimingTemplateForm';
import { TimingTemplateCard } from '@/components/features/settings/TimingTemplateCard';
import { HolidayCalendar } from '@/components/features/settings/HolidayCalendar';
import { VacationManager } from '@/components/features/settings/VacationManager';
import { useClasses } from '@/hooks/useCoreLookups';
import { useActiveAcademicYear } from '@/hooks/useAcademicYears';
import {
  useAssignClassesToTimingTemplate,
  useCreatePublicHoliday,
  useCreateTimingTemplate,
  useDeletePublicHoliday,
  usePublicHolidays,
  useSchoolDays,
  useTimingTemplates,
  useUpdatePublicHoliday,
  useUpdateSchoolDays,
} from '@/hooks/useScheduleSettings';

import { AssessmentTypeList } from '@/components/features/settings/AssessmentTypeList';
import { GradeTemplateBuilder } from '@/components/features/settings/GradeTemplateBuilder';
import { GradeTemplateAssignment } from '@/components/features/settings/GradeTemplateAssignment';
import { LeaveQuotaSetting } from '@/components/features/settings/LeaveQuotaSetting';

import { CommunicationSettings } from '@/components/features/settings/CommunicationSettings';
import { LibraryCategoryEditor } from '@/components/features/settings/LibraryCategoryEditor';

import { BehaviorSettings } from '@/components/features/settings/BehaviorSettings';

export default function SettingsPage() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const { user } = useAuth();
  const [wizardOpened, { open: openWizard, close: closeWizard }] = useDisclosure(false);
  const [copyModalOpened, { open: openCopyModal, close: closeCopyModal }] = useDisclosure(false);
  const [activeTab, setActiveTab] = useState<string | null>('permissions');
  const statusQuery = useSettingsStatus();
  const branchesQuery = useTenantBranches();
  const saveWizard = useSaveSetupWizard();
  const qc = useQueryClient();

  const hasCurrentBranch = !!user?.currentBranch?.id;
  const isInitialized = statusQuery.data?.data?.isInitialized ?? false;
  const branches = branchesQuery.data?.data ?? [];
  const hasMultipleBranches = branches.length > 1;

  const handleWizardComplete = async () => {
    await qc.invalidateQueries({ queryKey: ['settingsStatus'] });
    closeWizard();
  };

  const handleCopySuccess = () => {
    void qc.invalidateQueries({ queryKey: ['settingsStatus'] });
  };

  // Show message if no branch is selected
  if (!hasCurrentBranch) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <div className="page-sub-title-bar"></div>
        <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
          <Alert color={colors.warning} title="No Branch Selected">
            <Text size="sm">
              Please select a branch from the branch switcher in the header to access settings.
            </Text>
          </Alert>
        </div>
      </>
    );
  }

  if (statusQuery.isLoading || branchesQuery.isLoading) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <div className="page-sub-title-bar"></div>
        <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
          <Stack gap="md">
            <Skeleton height={40} width="30%" />
            <Skeleton height={400} />
          </Stack>
        </div>
      </>
    );
  }

  if (statusQuery.error) {
    return (
      <>
        <div className="page-title-bar">
          <Group justify="space-between" w="100%">
            <Title order={1}>Settings</Title>
          </Group>
        </div>
        <div className="page-sub-title-bar"></div>
        <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
          <Alert color={colors.error} title="Failed to load settings status">
            <Text size="sm">Please try again. If the issue persists, ensure you have access to the selected branch.</Text>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Settings</Title>
          {!isInitialized && (
            <Group gap="sm">
              {hasMultipleBranches && (
                <Button
                  variant="light"
                  leftSection={<IconCopy size={16} />}
                  onClick={openCopyModal}
                >
                  Copy Settings from Other Branch
                </Button>
              )}
              <Button
                leftSection={<IconRocket size={16} />}
                onClick={openWizard}
                color={colors.primary}
              >
                Start School Setup
              </Button>
            </Group>
          )}
        </Group>
      </div>

      <div className="page-sub-title-bar"></div>

      <div style={{ marginTop: '60px', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)', paddingTop: 'var(--mantine-spacing-sm)', paddingBottom: 'var(--mantine-spacing-xl)' }}>
        {!isInitialized && (
          <Alert color={colors.info} title="Setup Required" mb="md">
            <Text size="sm">
              Your school settings are not yet configured. Click "Start School Setup" to begin the guided setup process,
              or copy settings from another branch if available.
            </Text>
          </Alert>
        )}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="permissions" leftSection={<IconShield size={16} />}>
              Permissions
            </Tabs.Tab>
            <Tabs.Tab value="academic-years" leftSection={<IconCalendar size={16} />}>
              Academic Years
            </Tabs.Tab>
            <Tabs.Tab value="academic" leftSection={<IconSchool size={16} />}>
              Academic
            </Tabs.Tab>
            <Tabs.Tab value="schedule" leftSection={<IconClock size={16} />}>
              Schedule
            </Tabs.Tab>
            <Tabs.Tab value="assessment" leftSection={<IconClipboardList size={16} />}>
              Assessment
            </Tabs.Tab>
            <Tabs.Tab value="communication" leftSection={<IconMessage size={16} />}>
              Communication
            </Tabs.Tab>
            <Tabs.Tab value="behavior" leftSection={<IconMoodHappy size={16} />}>
              Behavior
            </Tabs.Tab>
          </Tabs.List>

          {/* Permissions Tab */}
          <Tabs.Panel value="permissions" pt="md" px="md" pb="md">
            <PermissionsTabContent />
          </Tabs.Panel>

          {/* Academic Years Tab */}
          <Tabs.Panel value="academic-years" pt="md" px="md" pb="md">
            <AcademicYearsTabContent />
          </Tabs.Panel>

          {/* Academic Tab */}
          <Tabs.Panel value="academic" pt="md" px="md" pb="md">
            <AcademicTabContent />
          </Tabs.Panel>

          {/* Schedule Tab */}
          <Tabs.Panel value="schedule" pt="md" px="md" pb="md">
            <ScheduleTabContent />
          </Tabs.Panel>

          {/* Assessment Tab */}
          <Tabs.Panel value="assessment" pt="md" px="md" pb="md">
            <AssessmentTabContent />
          </Tabs.Panel>

          {/* Communication Tab */}
          <Tabs.Panel value="communication" pt="md" px="md" pb="md">
            <CommunicationTabContent />
          </Tabs.Panel>

          {/* Behavior Tab */}
          <Tabs.Panel value="behavior" pt="md" px="md" pb="md">
            <BehaviorTabContent />
          </Tabs.Panel>
        </Tabs>
      </div>

      <SetupWizard
        opened={wizardOpened}
        onClose={closeWizard}
        onComplete={handleWizardComplete}
      />

      <CopySettingsModal
        opened={copyModalOpened}
        onClose={closeCopyModal}
        onSuccess={handleCopySuccess}
      />
    </>
  );
}

// Tab Content Components
function PermissionsTabContent() {
  const colors = useThemeColors();
  const { permissions, isLoading, error, refetch } = usePermissions();
  const { data: rolesData } = useRoles();
  const { data: featuresData } = useFeatures();

  const roles = rolesData?.data || [];
  const features = featuresData?.data || [];

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={400} />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color={colors.error} title="Failed to load permissions">
        <Group justify="space-between" mt="sm">
          <Text size="sm">Please try again.</Text>
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  return <PermissionMatrix roles={roles} features={features} permissions={permissions} />;
}

function AcademicYearsTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [opened, { open, close }] = useDisclosure(false);

  const listQuery = useAcademicYearsList({ page: 1, limit: 50, search: '' });
  const createMutation = useCreateAcademicYear();
  const activateMutation = useActivateAcademicYear();
  const lockMutation = useLockAcademicYear();

  const handleCreate = async (values: AcademicYearFormValues) => {
    await createMutation.mutateAsync(values);
  };

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync(id);
      notifications.show({ title: 'Success', message: 'Academic year activated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleLock = async (id: string) => {
    try {
      await lockMutation.mutateAsync(id);
      notifications.show({ title: 'Success', message: 'Academic year locked', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Academic Years</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Create
        </Button>
      </Group>

      {listQuery.isLoading ? (
        <Stack gap="md">
          <Skeleton height={40} width="30%" />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </Stack>
      ) : listQuery.error ? (
        <Alert color={colors.error} title="Failed to load academic years">
          <Group justify="space-between" mt="sm">
            <Text size="sm">Please try again.</Text>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => listQuery.refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      ) : (listQuery.data?.data?.length ?? 0) === 0 ? (
        <Alert color={colors.info} title="No academic years yet">
          <Text size="sm">Create your first academic year to start configuring the system.</Text>
        </Alert>
      ) : (
        <Stack gap="md">
          {listQuery.data?.data.map((year) => (
            <AcademicYearCard
              key={year.id}
              year={year}
              onActivate={handleActivate}
              onLock={handleLock}
              isActivating={activateMutation.isPending}
              isLocking={lockMutation.isPending}
            />
          ))}
        </Stack>
      )}

      <AcademicYearForm
        opened={opened}
        onClose={close}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />
    </>
  );
}

function AcademicTabContent() {
  return (
    <Tabs defaultValue="subjects">
      <Tabs.List>
        <Tabs.Tab value="subjects">Subjects</Tabs.Tab>
        <Tabs.Tab value="classes">Classes</Tabs.Tab>
        <Tabs.Tab value="sections">Sections</Tabs.Tab>
        <Tabs.Tab value="levels">Levels</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="subjects" pt="md">
        <SubjectList />
      </Tabs.Panel>
      <Tabs.Panel value="classes" pt="md">
        <ClassList />
      </Tabs.Panel>
      <Tabs.Panel value="sections" pt="md">
        <SectionList />
      </Tabs.Panel>
      <Tabs.Panel value="levels" pt="md">
        <LevelManager />
      </Tabs.Panel>
    </Tabs>
  );
}

function ScheduleTabContent() {
  const colors = useThemeColors();
  const notifyColors = useNotificationColors();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const schoolDaysQuery = useSchoolDays();
  const updateSchoolDays = useUpdateSchoolDays();
  const templatesQuery = useTimingTemplates();
  const createTemplate = useCreateTimingTemplate();
  const assignClasses = useAssignClassesToTimingTemplate();
  const classesQuery = useClasses();
  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;
  const holidaysQuery = usePublicHolidays(activeYearId);
  const createHoliday = useCreatePublicHoliday();
  const updateHoliday = useUpdatePublicHoliday();
  const deleteHoliday = useDeletePublicHoliday();

  const isLoading =
    schoolDaysQuery.isLoading ||
    templatesQuery.isLoading ||
    classesQuery.isLoading ||
    activeYearQuery.isLoading ||
    (activeYearId ? holidaysQuery.isLoading : false);

  const hasError =
    schoolDaysQuery.error ||
    templatesQuery.error ||
    classesQuery.error ||
    activeYearQuery.error ||
    holidaysQuery.error;

  const handleCreateTemplate = async (values: TimingTemplateFormValues) => {
    try {
      await createTemplate.mutateAsync({
        name: values.name,
        startTime: values.startTime,
        endTime: values.endTime,
        periodDurationMinutes: values.periodDurationMinutes,
        slots: values.slots,
      });
      notifications.show({ title: 'Success', message: 'Timing template created', color: notifyColors.success });
      closeCreate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleAssignClasses = async (templateId: string, classIds: string[]) => {
    try {
      await assignClasses.mutateAsync({ templateId, classIds });
      notifications.show({ title: 'Success', message: 'Assignments updated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleCreateHoliday = async (values: { name: string; startDate: string; endDate: string; academicYearId: string }) => {
    try {
      await createHoliday.mutateAsync(values);
      notifications.show({ title: 'Success', message: 'Holiday created', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleUpdateHoliday = async (
    id: string,
    values: { name: string; startDate: string; endDate: string; academicYearId: string },
  ) => {
    try {
      await updateHoliday.mutateAsync({ id, ...values });
      notifications.show({ title: 'Success', message: 'Holiday updated', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!activeYearId) return;
    try {
      await deleteHoliday.mutateAsync({ id, academicYearId: activeYearId });
      notifications.show({ title: 'Success', message: 'Holiday deleted', color: notifyColors.success });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      notifications.show({ title: 'Error', message, color: notifyColors.error });
    }
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={40} width="30%" />
        <Skeleton height={200} />
        <Skeleton height={200} />
        <Skeleton height={200} />
      </Stack>
    );
  }

  if (hasError) {
    return (
      <Alert color={colors.error} title="Failed to load schedule settings">
        <Group justify="flex-end" mt="sm">
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={() => {
              void schoolDaysQuery.refetch();
              void templatesQuery.refetch();
              void classesQuery.refetch();
              void activeYearQuery.refetch();
              void holidaysQuery.refetch();
            }}
          >
            Retry
          </Button>
        </Group>
      </Alert>
    );
  }

  return (
    <>
      <Stack gap="xl">
        <SchoolDaysSelector
          initialActiveDays={schoolDaysQuery.data?.data ?? []}
          isSaving={updateSchoolDays.isPending}
          onSave={(days) => updateSchoolDays.mutateAsync(days).then(() => Promise.resolve())}
        />

        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Title order={2}>Timing templates</Title>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
              New template
            </Button>
          </Group>
          {(templatesQuery.data?.data ?? []).length === 0 && (
            <Alert color={colors.warning} title="School start and end times are set in timing templates">
              Create at least one timing template and provide <strong>school start time</strong> and{' '}
              <strong>school end time</strong>.
            </Alert>
          )}
          <Stack gap="md">
            {(templatesQuery.data?.data ?? []).map((t) => (
              <TimingTemplateCard
                key={t.id}
                template={t}
                classes={classesQuery.data?.data ?? []}
                isSavingAssignments={assignClasses.isPending}
                onAssignClasses={handleAssignClasses}
              />
            ))}
          </Stack>
        </Stack>

        <Stack gap="md">
          <Title order={2}>Public holidays</Title>
          {!activeYearId ? (
            <Alert color={colors.warning} title="No active academic year">
              Create and activate an academic year to manage holidays.
            </Alert>
          ) : (
            <HolidayCalendar
              holidays={holidaysQuery.data?.data ?? []}
              academicYearId={activeYearId}
              isCreating={createHoliday.isPending || updateHoliday.isPending || deleteHoliday.isPending}
              onCreate={handleCreateHoliday}
              onUpdate={handleUpdateHoliday}
              onDelete={handleDeleteHoliday}
            />
          )}
        </Stack>

        <Stack gap="md">
          <VacationManager academicYearId={activeYearId} />
        </Stack>
      </Stack>

      <TimingTemplateForm
        opened={createOpened}
        onClose={closeCreate}
        onSubmit={handleCreateTemplate}
        isSubmitting={createTemplate.isPending}
      />
    </>
  );
}

function AssessmentTabContent() {
  const activeYearQuery = useActiveAcademicYear();
  const activeYearId = activeYearQuery.data?.data?.id;

  return (
    <Tabs defaultValue="types">
      <Tabs.List>
        <Tabs.Tab value="types">Assessment types</Tabs.Tab>
        <Tabs.Tab value="templates">Grade templates</Tabs.Tab>
        <Tabs.Tab value="assignments">Assignments</Tabs.Tab>
        <Tabs.Tab value="leave">Leave quota</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="types" pt="md">
        <AssessmentTypeList />
      </Tabs.Panel>
      <Tabs.Panel value="templates" pt="md">
        <GradeTemplateBuilder />
      </Tabs.Panel>
      <Tabs.Panel value="assignments" pt="md">
        <GradeTemplateAssignment />
      </Tabs.Panel>
      <Tabs.Panel value="leave" pt="md">
        <LeaveQuotaSetting academicYearId={activeYearId} />
      </Tabs.Panel>
    </Tabs>
  );
}

function CommunicationTabContent() {
  return (
    <Stack gap="xl">
      <CommunicationSettings />
      <LibraryCategoryEditor />
    </Stack>
  );
}

function BehaviorTabContent() {
  return <BehaviorSettings />;
}
