'use client';

import { Alert, Button, Group, Loader, Stack, Title } from '@mantine/core';
import { IconPlus, IconRefresh } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
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
import { useNotificationColors, useThemeColors } from '@/lib/hooks/use-theme-colors';

export default function ScheduleSettingsPage() {
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

  return (
    <>
      <div className="page-title-bar">
        <Group justify="space-between" w="100%">
          <Title order={1}>Schedule Settings</Title>
        </Group>
      </div>

      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader color={colors.primary} />
        </Group>
      ) : hasError ? (
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
      ) : (
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
      )}

      <TimingTemplateForm
        opened={createOpened}
        onClose={closeCreate}
        onSubmit={handleCreateTemplate}
        isSubmitting={createTemplate.isPending}
      />
    </>
  );
}


