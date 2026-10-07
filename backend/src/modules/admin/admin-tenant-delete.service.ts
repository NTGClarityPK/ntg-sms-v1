import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

const CHUNK = 200;

const BRANCH_DELETE_ORDER: string[] = [
  'fee_late_fee_applications',
  'fee_payments',
  'fee_challan_month_coverage',
  'fee_challans',
  'fee_metric_exclusions',
  'fee_student_template_links',
  'fee_template_assignments',
  'fee_templates',
  'fee_challan_settings',
  'fee_challan_generation_jobs',
  'id_card_reprints',
  'id_card_photos',
  'id_cards',
  'id_card_generation_jobs',
  'id_card_templates',
  'certificates',
  'certificate_settings',
  'certificate_number_counters',
  'student_framework_category_scores',
  'student_framework_ratings',
  'branch_behavioral_config',
  'behavioral_framework_presets',
  'student_rubric_scores',
  'assessment_rubrics',
  'rubric_presets',
  'google_sync_audit_log',
  'google_classroom_course_mappings',
  'google_workspace_settings',
  'teacher_substitutions',
  'academic_year_rollovers',
  'student_promotion_decisions',
  'student_enrolments',
  'library_items',
  'conversations',
  'student_grades',
  'student_assessment_statuses',
  'assessment_draft_files',
  'assessments',
  'result_cards',
  'result_report_settings',
  'attendance',
  'leave_requests',
  'early_departure_requests',
  'event_consents',
  'event_participants',
  'events',
  'behavioral_assessments',
  'timetable_slots',
  'teacher_assignments',
  'class_timing_assignments',
  'timing_templates',
  'uniform_issuances',
  'uniform_requests',
  'uniform_stock',
  'uniform_items',
  'student_subject_template_assignments',
  'class_subject_template_assignments',
  'level_subject_template_assignments',
  'subject_templates',
  'class_grade_assignments',
  'grade_templates',
  'assessment_types',
  'students',
  'staff',
  'class_sections',
  'dashboard_preferences',
  'storage_usage',
  'storage_alerts',
  'role_permissions',
  'user_roles',
  'user_branches',
  'school_days',
  'public_holidays',
  'subjects',
  'classes',
  'sections',
  'levels',
];

/**
 * Tenant-scoped rows with NO ACTION / leftover after branch deletes.
 * Must clear before deleting tenants (subjects_tenant_id_fkey etc.).
 */
const TENANT_DELETE_ORDER: string[] = [
  'school_data_export_logs',
  'subscription_invoices',
  'billing_payment_events',
  'subscriptions',
  'academic_years',
  'assessment_types',
  'grade_templates',
  'subjects',
  'classes',
  'sections',
  'levels',
  'public_holidays',
  'timing_templates',
  'school_days',
  'subject_templates',
  'api_hits',
];

@Injectable()
export class AdminTenantDeleteService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  async deleteTenant(
    tenantId: string,
    confirmTenantId: string,
    confirm: boolean,
  ): Promise<Record<string, unknown>> {
    if (!confirm) {
      throw new BadRequestException('confirm must be true');
    }
    if (confirmTenantId !== tenantId) {
      throw new BadRequestException('confirmTenantId must match tenantId');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, code')
      .eq('id', tenantId)
      .maybeSingle();
    throwIfDbError(error);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const tenantRow = tenant as { id: string; name: string; code: string };
    const summary: Record<string, number | string> = {};
    const warnings: string[] = [];

    const { data: branches } = await supabase
      .from('branches')
      .select('id')
      .eq('tenant_id', tenantId);
    const branchIds = (branches ?? []).map((b) => (b as { id: string }).id);
    summary.branches = branchIds.length;

    for (const table of BRANCH_DELETE_ORDER) {
      try {
        const n = await this.deleteIn(supabase, table, 'branch_id', branchIds);
        if (n > 0) summary[table] = n;
      } catch (e) {
        warnings.push(
          `${table}: ${e instanceof Error ? e.message : 'delete failed'}`,
        );
      }
    }

    if (branchIds.length > 0) {
      try {
        const n = await this.deleteIn(supabase, 'branches', 'id', branchIds);
        summary.branchesDeleted = n;
      } catch (e) {
        warnings.push(
          `branches: ${e instanceof Error ? e.message : 'delete failed'}`,
        );
      }
    }

    // Clear RESTRICT children of subjects before tenant-scoped subject delete
    try {
      const cleared = await this.clearSubjectRestrictChildren(supabase, tenantId);
      if (cleared.assessments > 0) summary.subjectAssessments = cleared.assessments;
      if (cleared.mappings > 0) summary.subjectMappings = cleared.mappings;
    } catch (e) {
      throw new BadRequestException(
        `Failed clearing subject dependents: ${e instanceof Error ? e.message : 'unknown'}`,
      );
    }

    // Tenant-scoped NO ACTION FKs — do not swallow errors (blocks tenant delete)
    for (const table of TENANT_DELETE_ORDER) {
      try {
        const n = await this.deleteEq(supabase, table, 'tenant_id', tenantId);
        if (n > 0) summary[table] = n;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'delete failed';
        warnings.push(`${table}: ${msg}`);
        throw new BadRequestException(
          `Failed while clearing ${table} for tenant delete: ${msg}`,
        );
      }
    }

    const { error: tenantDeleteError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);
    if (tenantDeleteError) {
      throw new BadRequestException(
        `Failed to delete tenant: ${tenantDeleteError.message}`,
      );
    }

    return {
      deleted: true,
      tenantId: tenantRow.id,
      tenantName: tenantRow.name,
      summary,
      warnings,
    };
  }

  private async deleteIn(
    supabase: SupabaseClient,
    table: string,
    column: string,
    values: string[],
  ): Promise<number> {
    if (values.length === 0) return 0;
    let deleted = 0;
    for (let i = 0; i < values.length; i += CHUNK) {
      const batch = values.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .in(column, batch);
      if (error) throw new Error(error.message);
      deleted += count ?? batch.length;
    }
    return deleted;
  }

  private async deleteEq(
    supabase: SupabaseClient,
    table: string,
    column: string,
    value: string,
  ): Promise<number> {
    const { error, count } = await supabase
      .from(table)
      .delete({ count: 'exact' })
      .eq(column, value);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  /** assessments.subject_id and google mappings are RESTRICT — must go before subjects */
  private async clearSubjectRestrictChildren(
    supabase: SupabaseClient,
    tenantId: string,
  ): Promise<{ assessments: number; mappings: number }> {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('id')
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
    const subjectIds = (subjects ?? []).map((s) => (s as { id: string }).id);
    if (subjectIds.length === 0) return { assessments: 0, mappings: 0 };

    let assessments = 0;
    let mappings = 0;
    for (let i = 0; i < subjectIds.length; i += CHUNK) {
      const batch = subjectIds.slice(i, i + CHUNK);
      const { error: aErr, count: aCount } = await supabase
        .from('assessments')
        .delete({ count: 'exact' })
        .in('subject_id', batch);
      if (aErr) throw new Error(aErr.message);
      assessments += aCount ?? 0;

      const { error: mErr, count: mCount } = await supabase
        .from('google_classroom_course_mappings')
        .delete({ count: 'exact' })
        .in('subject_id', batch);
      if (mErr) throw new Error(mErr.message);
      mappings += mCount ?? 0;
    }
    return { assessments, mappings };
  }
}
