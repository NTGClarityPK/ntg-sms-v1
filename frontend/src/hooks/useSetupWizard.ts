import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api-client';
import { useCreateAcademicYear, useActivateAcademicYear } from './useAcademicYears';
import { useCreateSubject, useCreateClass, useCreateSection, useCreateLevel } from './useCoreLookups';
import { useCreateTimingTemplate, useUpdateSchoolDays } from './useScheduleSettings';
import { useCreateAssessmentType, useCreateGradeTemplate, useSetLeaveQuota } from './useAssessmentSettings';
import { useUpdateSystemSetting } from './useSystemSettings';
import type { SetupWizardData } from '@/components/features/settings/wizard-steps/types';
import type { SubjectData } from '@/components/features/settings/wizard-steps/types';
import { validateSetupWizardDataBeforeSave } from '@/lib/setup-wizard/validate-setup-wizard-data';
import { notifications } from '@mantine/notifications';
import { useNotificationColors } from '@/lib/hooks/use-theme-colors';
import type { AcademicYear, AssessmentType, ClassEntity, GradeTemplate, Level, Section, Subject, TimingTemplate } from '@/types/settings';
import type { AxiosError } from 'axios';

function asList<T>(res: { data?: unknown }): T[] {
  return Array.isArray(res.data) ? res.data : [];
}

function isDuplicateKeyError(err: unknown): boolean {
  const ax = err as AxiosError<{ error?: { message?: string } }>;
  const message = (ax.response?.data?.error?.message ?? ax.message ?? '').toLowerCase();
  return (
    message.includes('duplicate key') ||
    message.includes('unique constraint') ||
    message.includes('already exists')
  );
}

function wizardSubjectKey(subject: SubjectData): string {
  const code = subject.code?.trim();
  if (code) return `code:${code.toLowerCase()}`;
  return `name:${subject.name.trim().toLowerCase()}`;
}

function seedSubjectMap(subjects: Subject[], map: Map<string, string>): void {
  for (const s of subjects) {
    if (s.code?.trim()) {
      map.set(`code:${s.code.trim().toLowerCase()}`, s.id);
    }
    map.set(`name:${s.name.trim().toLowerCase()}`, s.id);
  }
}

function patchSubjectMapFromRow(row: Subject, map: Map<string, string>): void {
  seedSubjectMap([row], map);
}

export function useSaveSetupWizard() {
  const qc = useQueryClient();
  const locale = useLocale();
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
      validateSetupWizardDataBeforeSave(data);

      const listParams = { page: 1, limit: 500 };

      const [subjectsRes, classesRes, sectionsRes, levelsRes, typesRes, templatesRes, timingRes] =
        await Promise.all([
          apiClient.get<Subject[]>('/api/v1/subjects', {
            params: { ...listParams, language: locale },
          }),
          apiClient.get<ClassEntity[]>('/api/v1/classes', { params: listParams }),
          apiClient.get<Section[]>('/api/v1/sections', { params: listParams }),
          apiClient.get<Level[]>('/api/v1/levels', { params: listParams }),
          apiClient.get<AssessmentType[]>('/api/v1/assessment-types', {
            params: { ...listParams, language: locale },
          }),
          apiClient.get<GradeTemplate[]>('/api/v1/grade-templates'),
          apiClient.get<TimingTemplate[]>('/api/v1/timing-templates', { params: listParams }),
        ]);

      const subjectKeyToId = new Map<string, string>();
      seedSubjectMap(asList<Subject>(subjectsRes), subjectKeyToId);

      const classNameToId = new Map<string, string>();
      for (const c of asList<ClassEntity>(classesRes)) {
        classNameToId.set(c.name, c.id);
      }

      const sectionNameToId = new Map<string, string>();
      for (const s of asList<Section>(sectionsRes)) {
        sectionNameToId.set(s.name, s.id);
      }

      const levelNameToId = new Map<string, string>();
      for (const l of asList<Level>(levelsRes)) {
        levelNameToId.set(l.name, l.id);
      }

      const assessmentTypeNameToId = new Map<string, string>();
      for (const t of asList<AssessmentType>(typesRes)) {
        assessmentTypeNameToId.set(t.name.trim().toLowerCase(), t.id);
      }

      const gradeTemplateNameToId = new Map<string, string>();
      for (const g of asList<GradeTemplate>(templatesRes)) {
        gradeTemplateNameToId.set(g.name.trim().toLowerCase(), g.id);
      }

      const timingTemplateNameToId = new Map<string, string>();
      for (const tt of asList<TimingTemplate>(timingRes)) {
        timingTemplateNameToId.set(tt.name.trim().toLowerCase(), tt.id);
      }

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

      // 2. Academic structure (idempotent)
      for (const subject of data.academic.subjects) {
        const key = wizardSubjectKey(subject);
        if (subjectKeyToId.has(key)) continue;

        try {
          const created = await createSubject.mutateAsync({
            name: subject.name,
            code: subject.code,
            sortOrder: subject.sortOrder,
          });
          if (created.data?.id) {
            patchSubjectMapFromRow(created.data, subjectKeyToId);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const refresh = await apiClient.get<Subject[]>('/api/v1/subjects', {
            params: { ...listParams, language: locale },
          });
          seedSubjectMap(asList<Subject>(refresh), subjectKeyToId);
          if (!subjectKeyToId.has(key)) throw err;
        }
      }

      for (const cls of data.academic.classes) {
        if (classNameToId.has(cls.name)) continue;
        try {
          const created = await createClass.mutateAsync({
            name: cls.name,
            displayName: cls.displayName,
            sortOrder: cls.sortOrder,
          });
          if (created.data?.id) {
            classNameToId.set(cls.name, created.data.id);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const refresh = await apiClient.get<ClassEntity[]>('/api/v1/classes', { params: listParams });
          for (const c of asList<ClassEntity>(refresh)) {
            classNameToId.set(c.name, c.id);
          }
          if (!classNameToId.has(cls.name)) throw err;
        }
      }

      for (const section of data.academic.sections) {
        if (sectionNameToId.has(section.name)) continue;
        try {
          const created = await createSection.mutateAsync({
            name: section.name,
            sortOrder: section.sortOrder,
          });
          if (created.data?.id) {
            sectionNameToId.set(section.name, created.data.id);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const refresh = await apiClient.get<Section[]>('/api/v1/sections', { params: listParams });
          for (const s of asList<Section>(refresh)) {
            sectionNameToId.set(s.name, s.id);
          }
          if (!sectionNameToId.has(section.name)) throw err;
        }
      }

      for (const level of data.academic.levels) {
        if (levelNameToId.has(level.name)) continue;

        const resolvedClassIds =
          (level.classIds ?? [])
            .map((className) => classNameToId.get(className))
            .filter((id): id is string => typeof id === 'string' && id.length > 0);

        if ((level.classIds ?? []).length > 0 && resolvedClassIds.length !== (level.classIds ?? []).length) {
          throw new Error(
            `Unable to save level "${level.name}" because one or more selected classes were not created successfully.`,
          );
        }

        try {
          const created = await createLevel.mutateAsync({
            name: level.name,
            nameAr: level.nameAr,
            sortOrder: level.sortOrder,
            classIds: resolvedClassIds,
          });
          if (created.data?.id) {
            levelNameToId.set(level.name, created.data.id);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          levelNameToId.clear();
          const refresh = await apiClient.get<Level[]>('/api/v1/levels', { params: listParams });
          for (const l of asList<Level>(refresh)) {
            levelNameToId.set(l.name, l.id);
          }
          if (!levelNameToId.has(level.name)) throw err;
        }
      }

      // 3. Schedule
      if (data.schedule.schoolDays.length > 0) {
        const activeDays = data.schedule.schoolDays.filter((d) => d.isActive).map((d) => d.dayOfWeek);
        await updateSchoolDays.mutateAsync(activeDays);
      }

      for (const template of data.schedule.timingTemplates) {
        const tKey = template.name.trim().toLowerCase();
        if (timingTemplateNameToId.has(tKey)) continue;

        try {
          const created = await createTimingTemplate.mutateAsync({
            name: template.name,
            startTime: template.startTime,
            endTime: template.endTime,
            periodDurationMinutes: template.periodDurationMinutes,
            slots: template.slots,
          });
          if (created.data?.id) {
            timingTemplateNameToId.set(tKey, created.data.id);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const refresh = await apiClient.get<TimingTemplate[]>('/api/v1/timing-templates', {
            params: listParams,
          });
          for (const tt of asList<TimingTemplate>(refresh)) {
            timingTemplateNameToId.set(tt.name.trim().toLowerCase(), tt.id);
          }
          if (!timingTemplateNameToId.has(tKey)) throw err;
        }
      }

      // 4. Assessment
      for (const type of data.assessment.assessmentTypes) {
        const tKey = type.name.trim().toLowerCase();
        if (assessmentTypeNameToId.has(tKey)) continue;

        try {
          const created = await createAssessmentType.mutateAsync({
            name: type.name,
            nameAr: type.nameAr,
            sortOrder: type.sortOrder,
          });
          if (created.data?.id) {
            assessmentTypeNameToId.set(tKey, created.data.id);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const refresh = await apiClient.get<AssessmentType[]>('/api/v1/assessment-types', {
            params: { ...listParams, language: locale },
          });
          for (const row of asList<AssessmentType>(refresh)) {
            assessmentTypeNameToId.set(row.name.trim().toLowerCase(), row.id);
          }
          if (!assessmentTypeNameToId.has(tKey)) throw err;
        }
      }

      for (const template of data.assessment.gradeTemplates) {
        const gKey = template.name.trim().toLowerCase();
        if (gradeTemplateNameToId.has(gKey)) continue;

        try {
          const created = await createGradeTemplate.mutateAsync({
            name: template.name,
            ranges: template.ranges,
          });
          if (created.data?.id) {
            gradeTemplateNameToId.set(gKey, created.data.id);
          }
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          const refresh = await apiClient.get<GradeTemplate[]>('/api/v1/grade-templates');
          for (const row of asList<GradeTemplate>(refresh)) {
            gradeTemplateNameToId.set(row.name.trim().toLowerCase(), row.id);
          }
          if (!gradeTemplateNameToId.has(gKey)) throw err;
        }
      }

      if (yearId && data.assessment.leaveQuota != null) {
        await setLeaveQuota.mutateAsync({
          academicYearId: yearId,
          annualQuota: data.assessment.leaveQuota,
        });
      }

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
