import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useCreateAcademicYear, useActivateAcademicYear } from './useAcademicYears';
import { useCreateSubject, useCreateClass, useCreateSection, useCreateLevel } from './useCoreLookups';
import { useCreateTimingTemplate, useUpdateSchoolDays } from './useScheduleSettings';
import { useCreateAssessmentType, useCreateGradeTemplate, useSetLeaveQuota } from './useAssessmentSettings';
import { useUpdateSystemSetting } from './useSystemSettings';
import type { SetupWizardData } from '@/components/features/settings/wizard-steps/types';
import { notifications } from '@mantine/notifications';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import type { AcademicYear } from '@/types/settings';
import type { AxiosError } from 'axios';

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
  const setLeaveQuota = useSetLeaveQuota();
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
      let yearId: string | null = null;
      
      // 1. Create and activate academic year
      if (data.academicYear) {
        try {
          const created = await createAcademicYear.mutateAsync(data.academicYear);
          yearId = created.data?.id ?? null;
        } catch (err) {
          const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
          const message = axiosErr.response?.data?.error?.message ?? axiosErr.message ?? '';

          const isDuplicateYearName =
            message.includes('academic_years_name_key') ||
            message.includes('academic_years_tenant_id_name_key') ||
            message.toLowerCase().includes('duplicate key value');

          if (!isDuplicateYearName) throw err;

          // Fallback: the year name already exists. Fetch it and continue.
          const list = await apiClient.get<AcademicYear[]>('/api/v1/academic-years', {
            params: { page: 1, limit: 50, search: data.academicYear.name },
          });
          const match = (list.data ?? []).find((y) => y.name === data.academicYear?.name) ?? null;
          yearId = match?.id ?? null;
        }

        if (yearId) {
          await activateAcademicYear.mutateAsync(yearId);
        }
      }

      // 2. Create academic structure
      for (const subject of data.academic.subjects) {
        try {
          await createSubject.mutateAsync({ name: subject.name, code: subject.code });
        } catch (err) {
          const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
          const message = axiosErr.response?.data?.error?.message ?? axiosErr.message ?? '';
          const isDuplicateSubjectCode =
            message.includes('subjects_code_key') ||
            message.includes('subjects_tenant_id_code_key') ||
            message.includes('subjects_branch_id_code_key') ||
            message.toLowerCase().includes('duplicate key value');

          // If the subject already exists (same code), treat onboarding as idempotent and continue.
          if (!isDuplicateSubjectCode) throw err;
        }
      }

      // Create classes and keep a name -> id map so levels can reference real UUIDs
      const classNameToId = new Map<string, string>();
      for (const cls of data.academic.classes) {
        const created = await createClass.mutateAsync({
          name: cls.name,
          displayName: cls.displayName,
          sortOrder: cls.sortOrder,
        });
        if (created.data?.id) {
          classNameToId.set(cls.name, created.data.id);
        }
      }
      for (const section of data.academic.sections) {
        await createSection.mutateAsync({ name: section.name, sortOrder: section.sortOrder });
      }
      for (const level of data.academic.levels) {
        const resolvedClassIds =
          (level.classIds ?? [])
            .map((className) => classNameToId.get(className))
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        if ((level.classIds ?? []).length > 0 && resolvedClassIds.length !== (level.classIds ?? []).length) {
          throw new Error(
            `Unable to save level \"${level.name}\" because one or more selected classes were not created successfully.`,
          );
        }

        await createLevel.mutateAsync({ 
          name: level.name, 
          nameAr: level.nameAr,
          sortOrder: level.sortOrder,
          classIds: resolvedClassIds 
        });
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
      
      // Set leave quota for the academic year (if provided)
      if (yearId && data.assessment.leaveQuota != null) {
        await setLeaveQuota.mutateAsync({
          academicYearId: yearId,
          annualQuota: data.assessment.leaveQuota,
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

      // 6. Save permissions (if configured in wizard)
      if (data.permissions.length > 0) {
        await apiClient.put('/api/v1/permissions', {
          permissions: data.permissions,
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


