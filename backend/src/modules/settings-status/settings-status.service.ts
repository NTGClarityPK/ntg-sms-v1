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

    // Explicit completion flag set by bulk onboarding import.
    const { data: importInitFlag, error: importInitError } = await supabase
      .from('system_settings')
      .select('key')
      .eq('key', `settings_initialized:${branchId}`)
      .maybeSingle();
    throwIfDbError(importInitError);

    // Check Academic Year: at least one active academic year exists (scope by tenant when possible)
    const academicYearQuery = supabase
      .from('academic_years')
      .select('id')
      .eq('is_active', true)
      .limit(1);
    const { data: academicYears, error: academicYearsError } = tenantId
      ? await academicYearQuery.eq('tenant_id', tenantId)
      : await academicYearQuery;
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
      supabase
        .from('school_days')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .limit(1),
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

    const tabbedScreenReady =
      academicYear &&
      academic &&
      ((assessmentTypesResult.data?.length ?? 0) > 0 ||
        (gradeTemplatesResult.data?.length ?? 0) > 0);

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
      importInitFlag !== null ||
      (academicYear && academic && schedule && assessment && communication && behavior && permissions);

    return new SettingsStatusDto({
      academicYear,
      academic,
      schedule,
      assessment,
      communication,
      behavior,
      permissions,
      tabbedScreenReady,
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

    // Check which branches have settings initialized (parallel to avoid N+1 latency)
    const statuses = await Promise.all(
      branches.map(async (branch) => ({
        branch,
        status: await this.checkInitializationStatus(branch.id, tenantId),
      })),
    );

    return statuses
      .filter(({ status }) => status.isInitialized)
      .map(({ branch }) => ({
        id: branch.id,
        name: branch.name,
        code: branch.code,
      }));
  }

  async copySettingsFromBranch(
    sourceBranchId: string,
    targetBranchId: string,
    tenantId: string | null,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    if (!tenantId) throw new BadRequestException('Tenant not found for current branch');

    // Transactional, idempotent replication via Postgres RPC.
    const { error } = await supabase.rpc('copy_settings_from_branch', {
      source_branch_id: sourceBranchId,
      target_branch_id: targetBranchId,
      tenant_id: tenantId,
    });
    throwIfDbError(error);
  }
}

