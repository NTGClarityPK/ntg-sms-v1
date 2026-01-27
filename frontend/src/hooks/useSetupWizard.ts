import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useCreateAcademicYear, useActivateAcademicYear } from './useAcademicYears';
import { useCreateSubject, useCreateClass, useCreateSection, useCreateLevel } from './useCoreLookups';
import { useCreateTimingTemplate, useUpdateSchoolDays } from './useScheduleSettings';
import { useCreateAssessmentType, useCreateGradeTemplate } from './useAssessmentSettings';
import { useUpdateSystemSetting } from './useSystemSettings';
import type { SetupWizardData } from '@/components/features/settings/wizard-steps/types';
import { notifications } from '@mantine/notifications';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';

export function useSaveSetupWizard() {
  const qc = useQueryClient();
  const notifyColors = useNotificationColors();
  const createAcademicYear = useCreateAcademicYear();
  const activateAcademicYear = useActivateAcademicYear();
  const createSubject = useCreateSubject();
  const createClass = useCreateClass();
  const createSection = useCreateSection();
  const createLevel = useCreateLevel();
  const createTimingTemplate = useCreateTimingTemplate();
  const updateSchoolDays = useUpdateSchoolDays();
  const createAssessmentType = useCreateAssessmentType();
  const createGradeTemplate = useCreateGradeTemplate();
  const updateCommunicationSetting = useUpdateSystemSetting<{
    teacher_student: string;
    teacher_parent: string;
  }>('communication_direction');
  const updateBehaviorSetting = useUpdateSystemSetting<{
    enabled: boolean;
    mandatory: boolean;
    attributes: string[];
  }>('behavioral_assessment');

  return useMutation({
    mutationFn: async (data: SetupWizardData) => {
      // 1. Create and activate academic year
      if (data.academicYear) {
        const year = await createAcademicYear.mutateAsync(data.academicYear);
        if (year.data?.id) {
          await activateAcademicYear.mutateAsync(year.data.id);
        }
      }

      // 2. Create academic structure
      for (const subject of data.academic.subjects) {
        await createSubject.mutateAsync({ name: subject.name, code: subject.code });
      }
      for (const cls of data.academic.classes) {
        await createClass.mutateAsync({ name: cls.name, displayName: cls.displayName, sortOrder: cls.sortOrder });
      }
      for (const section of data.academic.sections) {
        await createSection.mutateAsync({ name: section.name, sortOrder: section.sortOrder });
      }
      for (const level of data.academic.levels) {
        await createLevel.mutateAsync({ name: level.name, classIds: level.classIds });
      }

      // 3. Create schedule settings
      if (data.schedule.schoolDays.length > 0) {
        const activeDays = data.schedule.schoolDays.filter((d) => d.isActive).map((d) => d.dayOfWeek);
        await updateSchoolDays.mutateAsync(activeDays);
      }
      for (const template of data.schedule.timingTemplates) {
        await createTimingTemplate.mutateAsync({
          name: template.name,
          startTime: template.startTime,
          endTime: template.endTime,
          periodDurationMinutes: template.periodDurationMinutes,
          slots: template.slots,
        });
      }

      // 4. Create assessment settings
      for (const type of data.assessment.assessmentTypes) {
        await createAssessmentType.mutateAsync({ name: type.name, sortOrder: type.sortOrder });
      }
      for (const template of data.assessment.gradeTemplates) {
        await createGradeTemplate.mutateAsync({
          name: template.name,
          ranges: template.ranges,
        });
      }

      // 5. Update system settings
      if (data.communication) {
        await updateCommunicationSetting.mutateAsync({
          teacher_student: data.communication.teacherStudent,
          teacher_parent: data.communication.teacherParent,
        });
      }
      if (data.behavior) {
        await updateBehaviorSetting.mutateAsync({
          enabled: data.behavior.enabled,
          mandatory: data.behavior.mandatory,
          attributes: data.behavior.attributes,
        });
      }

      return { success: true };
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      notifications.show({
        title: 'Success',
        message: 'All settings saved successfully',
        color: notifyColors.success,
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save settings',
        color: notifyColors.error,
      });
    },
  });
}

