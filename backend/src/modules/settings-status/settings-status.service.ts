import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SettingsStatusDto } from './dto/settings-status.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

@Injectable()
export class SettingsStatusService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async checkInitializationStatus(branchId: string, tenantId: string | null): Promise<SettingsStatusDto> {
    const supabase = this.supabaseConfig.getClient();

    // Check Academic Year: at least one active academic year exists
    const { data: academicYears, error: academicYearsError } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_active', true)
      .limit(1);
    throwIfDbError(academicYearsError);
    const academicYear = (academicYears?.length ?? 0) > 0;

    // Check Academic: at least one subject, class, section, and level exist
    const [subjectsResult, classesResult, sectionsResult, levelsResult] = await Promise.all([
      supabase.from('subjects').select('id').eq('branch_id', branchId).limit(1),
      supabase.from('classes').select('id').eq('branch_id', branchId).limit(1),
      supabase.from('sections').select('id').eq('branch_id', branchId).limit(1),
      supabase.from('levels').select('id').eq('branch_id', branchId).limit(1),
    ]);

    throwIfDbError(subjectsResult.error);
    throwIfDbError(classesResult.error);
    throwIfDbError(sectionsResult.error);
    throwIfDbError(levelsResult.error);

    const academic =
      (subjectsResult.data?.length ?? 0) > 0 &&
      (classesResult.data?.length ?? 0) > 0 &&
      (sectionsResult.data?.length ?? 0) > 0 &&
      (levelsResult.data?.length ?? 0) > 0;

    // Check Schedule: school days configured and at least one timing template exists
    const [schoolDaysResult, timingTemplatesResult] = await Promise.all([
      supabase.from('school_days').select('id').eq('is_active', true).limit(1),
      supabase.from('timing_templates').select('id').eq('branch_id', branchId).limit(1),
    ]);

    throwIfDbError(schoolDaysResult.error);
    throwIfDbError(timingTemplatesResult.error);

    const schedule =
      (schoolDaysResult.data?.length ?? 0) > 0 && (timingTemplatesResult.data?.length ?? 0) > 0;

    // Check Assessment: at least one assessment type, one grade template, and leave quota set
    const [assessmentTypesResult, gradeTemplatesResult, leaveSettingsResult] = await Promise.all([
      supabase.from('assessment_types').select('id').eq('branch_id', branchId).limit(1),
      supabase.from('grade_templates').select('id').eq('branch_id', branchId).limit(1),
      supabase.from('leave_settings').select('id').limit(1),
    ]);

    throwIfDbError(assessmentTypesResult.error);
    throwIfDbError(gradeTemplatesResult.error);
    throwIfDbError(leaveSettingsResult.error);

    const assessment =
      (assessmentTypesResult.data?.length ?? 0) > 0 &&
      (gradeTemplatesResult.data?.length ?? 0) > 0 &&
      (leaveSettingsResult.data?.length ?? 0) > 0;

    // Check Communication: communication_direction setting exists
    const { data: communicationSetting, error: communicationError } = await supabase
      .from('system_settings')
      .select('key')
      .eq('key', 'communication_direction')
      .maybeSingle();
    throwIfDbError(communicationError);
    const communication = communicationSetting !== null;

    // Check Behavior: behavioral_assessment setting exists
    const { data: behaviorSetting, error: behaviorError } = await supabase
      .from('system_settings')
      .select('key')
      .eq('key', 'behavioral_assessment')
      .maybeSingle();
    throwIfDbError(behaviorError);
    const behavior = behaviorSetting !== null;

    // Check Permissions: at least one role_permission record exists for the branch
    const { data: permissionsResult, error: permissionsError } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('branch_id', branchId)
      .limit(1);
    throwIfDbError(permissionsError);
    const permissions = (permissionsResult?.length ?? 0) > 0;

    const isInitialized =
      academicYear && academic && schedule && assessment && communication && behavior && permissions;

    return new SettingsStatusDto({
      academicYear,
      academic,
      schedule,
      assessment,
      communication,
      behavior,
      permissions,
      isInitialized,
    });
  }

  async getBranchesWithSettings(
    currentBranchId: string,
    tenantId: string | null,
  ): Promise<Array<{ id: string; name: string; code: string | null }>> {
    const supabase = this.supabaseConfig.getClient();

    if (!tenantId) {
      return [];
    }

    // Get all branches for the tenant
    const { data: branches, error: branchesError } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('tenant_id', tenantId)
      .neq('id', currentBranchId)
      .eq('is_active', true);

    throwIfDbError(branchesError);

    if (!branches || branches.length === 0) {
      return [];
    }

    // Check which branches have settings initialized
    const branchesWithSettings: Array<{ id: string; name: string; code: string | null }> = [];

    for (const branch of branches) {
      const status = await this.checkInitializationStatus(branch.id, tenantId);
      if (status.isInitialized) {
        branchesWithSettings.push({
          id: branch.id,
          name: branch.name,
          code: branch.code,
        });
      }
    }

    return branchesWithSettings;
  }

  async copySettingsFromBranch(
    sourceBranchId: string,
    targetBranchId: string,
    tenantId: string | null,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    // Validate both branches belong to same tenant
    const [sourceBranch, targetBranch] = await Promise.all([
      supabase.from('branches').select('id, tenant_id').eq('id', sourceBranchId).maybeSingle(),
      supabase.from('branches').select('id, tenant_id').eq('id', targetBranchId).maybeSingle(),
    ]);

    throwIfDbError(sourceBranch.error);
    throwIfDbError(targetBranch.error);

    if (!sourceBranch.data) {
      throw new BadRequestException('Source branch not found');
    }
    if (!targetBranch.data) {
      throw new BadRequestException('Target branch not found');
    }

    const sourceTenantId = (sourceBranch.data as { tenant_id: string | null }).tenant_id;
    const targetTenantId = (targetBranch.data as { tenant_id: string | null }).tenant_id;

    if (sourceTenantId !== targetTenantId || sourceTenantId !== tenantId) {
      throw new BadRequestException('Branches must belong to the same tenant');
    }

    // Copy Subjects
    const { data: sourceSubjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(subjectsError);

    if (sourceSubjects && sourceSubjects.length > 0) {
      const targetSubjects = sourceSubjects.map((s) => ({
        ...s,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error: insertSubjectsError } = await supabase.from('subjects').insert(targetSubjects);
      throwIfDbError(insertSubjectsError);
    }

    // Copy Classes
    const { data: sourceClasses, error: classesError } = await supabase
      .from('classes')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(classesError);

    if (sourceClasses && sourceClasses.length > 0) {
      const targetClasses = sourceClasses.map((c) => ({
        ...c,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error: insertClassesError } = await supabase.from('classes').insert(targetClasses);
      throwIfDbError(insertClassesError);
    }

    // Copy Sections
    const { data: sourceSections, error: sectionsError } = await supabase
      .from('sections')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(sectionsError);

    if (sourceSections && sourceSections.length > 0) {
      const targetSections = sourceSections.map((s) => ({
        ...s,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error: insertSectionsError } = await supabase.from('sections').insert(targetSections);
      throwIfDbError(insertSectionsError);
    }

    // Copy Levels
    const { data: sourceLevels, error: levelsError } = await supabase
      .from('levels')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(levelsError);

    if (sourceLevels && sourceLevels.length > 0) {
      const targetLevels = sourceLevels.map((l) => ({
        ...l,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error: insertLevelsError } = await supabase.from('levels').insert(targetLevels);
      throwIfDbError(insertLevelsError);

      // Copy level_classes relationships (need to map old class IDs to new class IDs)
      const { data: sourceLevelClasses, error: levelClassesError } = await supabase
        .from('level_classes')
        .select('*')
        .in(
          'level_id',
          sourceLevels.map((l) => l.id),
        );
      throwIfDbError(levelClassesError);

      if (sourceLevelClasses && sourceLevelClasses.length > 0) {
        // Create mapping of old level IDs to new level IDs
        const levelIdMap = new Map<string, string>();
        for (let i = 0; i < sourceLevels.length; i++) {
          const oldLevel = sourceLevels[i];
          const newLevel = targetLevels[i];
          levelIdMap.set(oldLevel.id, newLevel.id);
        }

        // Create mapping of old class IDs to new class IDs
        const classIdMap = new Map<string, string>();
        const { data: targetClasses, error: targetClassesError } = await supabase
          .from('classes')
          .select('id, name')
          .eq('branch_id', targetBranchId)
          .order('name');
        throwIfDbError(targetClassesError);

        if (targetClasses && sourceClasses) {
          // Match classes by name to create ID mapping
          for (const sourceClass of sourceClasses) {
            const targetClass = targetClasses.find((tc) => tc.name === sourceClass.name);
            if (targetClass) {
              classIdMap.set(sourceClass.id, targetClass.id);
            }
          }
        }

        const targetLevelClasses = sourceLevelClasses
          .map((lc) => {
            const newLevelId = levelIdMap.get(lc.level_id);
            const newClassId = classIdMap.get(lc.class_id);
            if (newLevelId && newClassId) {
              return {
                level_id: newLevelId,
                class_id: newClassId,
                created_at: undefined,
                updated_at: undefined,
              };
            }
            return null;
          })
          .filter((lc): lc is { level_id: string; class_id: string; created_at: undefined; updated_at: undefined } => lc !== null);

        if (targetLevelClasses.length > 0) {
          const { error: insertLevelClassesError } = await supabase
            .from('level_classes')
            .insert(targetLevelClasses);
          throwIfDbError(insertLevelClassesError);
        }
      }
    }

    // Copy Timing Templates
    const { data: sourceTemplates, error: templatesError } = await supabase
      .from('timing_templates')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(templatesError);

    if (sourceTemplates && sourceTemplates.length > 0) {
      const targetTemplates = sourceTemplates.map((t) => ({
        ...t,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { data: insertedTemplates, error: insertTemplatesError } = await supabase
        .from('timing_templates')
        .insert(targetTemplates)
        .select('id, name');
      throwIfDbError(insertTemplatesError);

      // Copy timing_template_slots
      if (insertedTemplates && insertedTemplates.length > 0) {
        const templateIdMap = new Map<string, string>();
        for (let i = 0; i < sourceTemplates.length; i++) {
          templateIdMap.set(sourceTemplates[i].id, insertedTemplates[i].id);
        }

        const { data: sourceSlots, error: slotsError } = await supabase
          .from('timing_template_slots')
          .select('*')
          .in(
            'timing_template_id',
            sourceTemplates.map((t) => t.id),
          );
        throwIfDbError(slotsError);

        if (sourceSlots && sourceSlots.length > 0) {
          const targetSlots = sourceSlots.map((s) => {
            const newTemplateId = templateIdMap.get(s.timing_template_id);
            if (newTemplateId) {
              return {
                ...s,
                id: undefined,
                timing_template_id: newTemplateId,
                created_at: undefined,
                updated_at: undefined,
              };
            }
            return null;
          }).filter((s): s is NonNullable<typeof s> => s !== null);

          if (targetSlots.length > 0) {
            const { error: insertSlotsError } = await supabase
              .from('timing_template_slots')
              .insert(targetSlots);
            throwIfDbError(insertSlotsError);
          }
        }

        // Copy class_timing_assignments (need to map old class IDs to new class IDs)
        const { data: sourceAssignments, error: assignmentsError } = await supabase
          .from('class_timing_assignments')
          .select('*');
        throwIfDbError(assignmentsError);

        if (sourceAssignments && sourceAssignments.length > 0) {
          const classIdMap = new Map<string, string>();
          const { data: targetClasses, error: targetClassesError } = await supabase
            .from('classes')
            .select('id, name')
            .eq('branch_id', targetBranchId);
          throwIfDbError(targetClassesError);

          const { data: sourceClassesForMapping, error: sourceClassesMappingError } = await supabase
            .from('classes')
            .select('id, name')
            .eq('branch_id', sourceBranchId);
          throwIfDbError(sourceClassesMappingError);

          if (targetClasses && sourceClassesForMapping) {
            for (const sourceClass of sourceClassesForMapping) {
              const targetClass = targetClasses.find((tc) => tc.name === sourceClass.name);
              if (targetClass) {
                classIdMap.set(sourceClass.id, targetClass.id);
              }
            }
          }

          const targetAssignments = sourceAssignments
            .map((a) => {
              const newClassId = classIdMap.get(a.class_id);
              const newTemplateId = templateIdMap.get(a.timing_template_id);
              if (newClassId && newTemplateId) {
                return {
                  class_id: newClassId,
                  timing_template_id: newTemplateId,
                  created_at: undefined,
                  updated_at: undefined,
                };
              }
              return null;
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);

          if (targetAssignments.length > 0) {
            const { error: insertAssignmentsError } = await supabase
              .from('class_timing_assignments')
              .insert(targetAssignments);
            throwIfDbError(insertAssignmentsError);
          }
        }
      }
    }

    // Copy Public Holidays (need active academic year in target branch)
    const { data: targetActiveYear, error: targetYearError } = await supabase
      .from('academic_years')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    throwIfDbError(targetYearError);

    if (targetActiveYear) {
      const { data: sourceHolidays, error: holidaysError } = await supabase
        .from('public_holidays')
        .select('*')
        .eq('branch_id', sourceBranchId);
      throwIfDbError(holidaysError);

      if (sourceHolidays && sourceHolidays.length > 0) {
        const targetHolidays = sourceHolidays.map((h) => ({
          ...h,
          id: undefined,
          branch_id: targetBranchId,
          tenant_id: tenantId,
          academic_year_id: (targetActiveYear as { id: string }).id,
          created_at: undefined,
          updated_at: undefined,
        }));
        const { error: insertHolidaysError } = await supabase.from('public_holidays').insert(targetHolidays);
        throwIfDbError(insertHolidaysError);
      }
    }

    // Copy Vacations (need active academic year in target branch)
    if (targetActiveYear) {
      const { data: sourceVacations, error: vacationsError } = await supabase
        .from('vacations')
        .select('*');
      throwIfDbError(vacationsError);

      if (sourceVacations && sourceVacations.length > 0) {
        const targetVacations = sourceVacations.map((v) => ({
          ...v,
          id: undefined,
          academic_year_id: (targetActiveYear as { id: string }).id,
          created_at: undefined,
          updated_at: undefined,
        }));
        const { error: insertVacationsError } = await supabase.from('vacations').insert(targetVacations);
        throwIfDbError(insertVacationsError);
      }
    }

    // Copy Assessment Types
    const { data: sourceAssessmentTypes, error: assessmentTypesError } = await supabase
      .from('assessment_types')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(assessmentTypesError);

    if (sourceAssessmentTypes && sourceAssessmentTypes.length > 0) {
      const targetAssessmentTypes = sourceAssessmentTypes.map((at) => ({
        ...at,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { error: insertAssessmentTypesError } = await supabase
        .from('assessment_types')
        .insert(targetAssessmentTypes);
      throwIfDbError(insertAssessmentTypesError);
    }

    // Copy Grade Templates and Ranges
    const { data: sourceGradeTemplates, error: gradeTemplatesError } = await supabase
      .from('grade_templates')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(gradeTemplatesError);

    if (sourceGradeTemplates && sourceGradeTemplates.length > 0) {
      const targetGradeTemplates = sourceGradeTemplates.map((gt) => ({
        ...gt,
        id: undefined,
        branch_id: targetBranchId,
        tenant_id: tenantId,
        created_at: undefined,
        updated_at: undefined,
      }));
      const { data: insertedGradeTemplates, error: insertGradeTemplatesError } = await supabase
        .from('grade_templates')
        .insert(targetGradeTemplates)
        .select('id, name');
      throwIfDbError(insertGradeTemplatesError);

      // Copy grade_ranges
      if (insertedGradeTemplates && insertedGradeTemplates.length > 0) {
        const templateIdMap = new Map<string, string>();
        for (let i = 0; i < sourceGradeTemplates.length; i++) {
          templateIdMap.set(sourceGradeTemplates[i].id, insertedGradeTemplates[i].id);
        }

        const { data: sourceRanges, error: rangesError } = await supabase
          .from('grade_ranges')
          .select('*')
          .in(
            'grade_template_id',
            sourceGradeTemplates.map((gt) => gt.id),
          );
        throwIfDbError(rangesError);

        if (sourceRanges && sourceRanges.length > 0) {
          const targetRanges = sourceRanges.map((r) => {
            const newTemplateId = templateIdMap.get(r.grade_template_id);
            if (newTemplateId) {
              return {
                ...r,
                id: undefined,
                grade_template_id: newTemplateId,
                created_at: undefined,
                updated_at: undefined,
              };
            }
            return null;
          }).filter((r): r is NonNullable<typeof r> => r !== null);

          if (targetRanges.length > 0) {
            const { error: insertRangesError } = await supabase.from('grade_ranges').insert(targetRanges);
            throwIfDbError(insertRangesError);
          }
        }

        // Copy class_grade_assignments (need to map old class IDs to new class IDs)
        const { data: sourceGradeAssignments, error: gradeAssignmentsError } = await supabase
          .from('class_grade_assignments')
          .select('*');
        throwIfDbError(gradeAssignmentsError);

        if (sourceGradeAssignments && sourceGradeAssignments.length > 0) {
          const classIdMap = new Map<string, string>();
          const { data: targetClasses, error: targetClassesError } = await supabase
            .from('classes')
            .select('id, name')
            .eq('branch_id', targetBranchId);
          throwIfDbError(targetClassesError);

          const { data: sourceClassesForMapping, error: sourceClassesMappingError } = await supabase
            .from('classes')
            .select('id, name')
            .eq('branch_id', sourceBranchId);
          throwIfDbError(sourceClassesMappingError);

          if (targetClasses && sourceClassesForMapping) {
            for (const sourceClass of sourceClassesForMapping) {
              const targetClass = targetClasses.find((tc) => tc.name === sourceClass.name);
              if (targetClass) {
                classIdMap.set(sourceClass.id, targetClass.id);
              }
            }
          }

          const targetGradeAssignments = sourceGradeAssignments
            .map((a) => {
              const newClassId = classIdMap.get(a.class_id);
              const newTemplateId = templateIdMap.get(a.grade_template_id);
              if (newClassId && newTemplateId) {
                return {
                  class_id: newClassId,
                  grade_template_id: newTemplateId,
                  minimum_passing_grade: a.minimum_passing_grade,
                  created_at: undefined,
                  updated_at: undefined,
                };
              }
              return null;
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);

          if (targetGradeAssignments.length > 0) {
            const { error: insertGradeAssignmentsError } = await supabase
              .from('class_grade_assignments')
              .insert(targetGradeAssignments);
            throwIfDbError(insertGradeAssignmentsError);
          }
        }
      }
    }

    // Copy Leave Settings (need active academic year in target branch)
    if (targetActiveYear) {
      const { data: sourceLeaveSettings, error: leaveSettingsError } = await supabase
        .from('leave_settings')
        .select('*');
      throwIfDbError(leaveSettingsError);

      if (sourceLeaveSettings && sourceLeaveSettings.length > 0) {
        const targetLeaveSettings = sourceLeaveSettings.map((ls) => ({
          ...ls,
          id: undefined,
          academic_year_id: (targetActiveYear as { id: string }).id,
          created_at: undefined,
          updated_at: undefined,
        }));
        const { error: insertLeaveSettingsError } = await supabase
          .from('leave_settings')
          .insert(targetLeaveSettings);
        throwIfDbError(insertLeaveSettingsError);
      }
    }

    // Copy System Settings (communication_direction, behavioral_assessment)
    const { data: sourceSystemSettings, error: systemSettingsError } = await supabase
      .from('system_settings')
      .select('*')
      .in('key', ['communication_direction', 'behavioral_assessment']);
    throwIfDbError(systemSettingsError);

    if (sourceSystemSettings && sourceSystemSettings.length > 0) {
      const { error: upsertSystemSettingsError } = await supabase
        .from('system_settings')
        .upsert(sourceSystemSettings, { onConflict: 'key' });
      throwIfDbError(upsertSystemSettingsError);
    }

    // Copy Role Permissions
    const { data: sourcePermissions, error: permissionsError } = await supabase
      .from('role_permissions')
      .select('*')
      .eq('branch_id', sourceBranchId);
    throwIfDbError(permissionsError);

    if (sourcePermissions && sourcePermissions.length > 0) {
      const targetPermissions = sourcePermissions.map((p) => ({
        ...p,
        id: undefined,
        branch_id: targetBranchId,
        updated_at: undefined,
      }));
      const { error: insertPermissionsError } = await supabase
        .from('role_permissions')
        .insert(targetPermissions);
      throwIfDbError(insertPermissionsError);
    }
  }
}

