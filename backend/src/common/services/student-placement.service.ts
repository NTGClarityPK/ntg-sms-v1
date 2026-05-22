import { BadRequestException, Injectable } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../config/supabase.config';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

export type ClassSectionPlacementFilter = {
  branchId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
};

/** Payload for upserting year-scoped placement — use upsertEnrolments / upsertEnrolment only. */
export type UpsertStudentEnrolmentInput = {
  student_id: string;
  branch_id: string;
  academic_year_id: string;
  class_id?: string | null;
  section_id?: string | null;
  status: string;
  created_by?: string | null;
  updated_by?: string | null;
};

export type UpsertEnrolmentsOptions = {
  /** Mirror affected rows onto `students` for this year (e.g. newly activated year after lock). */
  mirrorToStudentsForYearId?: string;
};

type EnrolmentRow = {
  class_id: string | null;
  section_id: string | null;
  status: string;
};

/**
 * Year-scoped student placement: student_enrolments is source of truth;
 * students.class_id / section_id / academic_year_id mirror the active year's enrolment.
 *
 * All application writes to student_enrolments MUST go through upsertEnrolment(s) here.
 */
@Injectable()
export class StudentPlacementService {
  constructor(private readonly supabaseConfig: SupabaseConfig) {}

  /**
   * Sole application write path for student_enrolments. Always mirrors onto students when the
   * row's academic year is the branch active year (or mirrorToStudentsForYearId is set).
   */
  async upsertEnrolments(
    rows: UpsertStudentEnrolmentInput[],
    options?: UpsertEnrolmentsOptions,
  ): Promise<{ upserted: number }> {
    if (rows.length === 0) return { upserted: 0 };

    const supabase = this.supabaseConfig.getClient();
    const { error } = await supabase.from('student_enrolments').upsert(rows, {
      onConflict: 'student_id,branch_id,academic_year_id',
    });
    throwIfDbError(error);

    const branchId = rows[0].branch_id;
    const yearsToMirror = new Set<string>();
    if (options?.mirrorToStudentsForYearId) {
      yearsToMirror.add(options.mirrorToStudentsForYearId);
    }
    const activeYearId = await this.resolveActiveAcademicYearIdForBranch(branchId);
    if (activeYearId) yearsToMirror.add(activeYearId);

    for (const yearId of yearsToMirror) {
      const studentIds = [
        ...new Set(
          rows.filter((r) => r.academic_year_id === yearId).map((r) => r.student_id).filter(Boolean),
        ),
      ];
      if (studentIds.length > 0) {
        await this.syncStudentRowsFromEnrolments(branchId, yearId, studentIds);
      }
    }

    return { upserted: rows.length };
  }

  async upsertEnrolment(
    row: UpsertStudentEnrolmentInput,
    options?: UpsertEnrolmentsOptions,
  ): Promise<void> {
    await this.upsertEnrolments([row], options);
  }

  /**
   * Align closing-year enrolments with saved promotion decisions (end-of-year placement on the locked year).
   * Call before year lock and after promotion saves so historical enrolment rows match decisions.
   */
  async applyPromotionDecisionsToClosingYearEnrolments(
    branchId: string,
    sourceAcademicYearId: string,
  ): Promise<{ upserted: number }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: decisions, error: dErr } = await supabase
      .from('student_promotion_decisions')
      .select('student_id, outcome, target_class_id, target_section_id')
      .eq('branch_id', branchId)
      .eq('source_academic_year_id', sourceAcademicYearId);
    throwIfDbError(dErr);

    const rows: UpsertStudentEnrolmentInput[] = ((decisions as Array<{
      student_id: string;
      outcome: string;
      target_class_id: string | null;
      target_section_id: string | null;
    }>) ?? []).map((d) => {
      if (d.outcome === 'promoted' || d.outcome === 'repeated') {
        return {
          student_id: d.student_id,
          branch_id: branchId,
          academic_year_id: sourceAcademicYearId,
          class_id: d.target_class_id,
          section_id: d.target_section_id,
          status: 'active',
        };
      }
      return {
        student_id: d.student_id,
        branch_id: branchId,
        academic_year_id: sourceAcademicYearId,
        class_id: null,
        section_id: null,
        status: d.outcome,
      };
    });

    return this.upsertEnrolments(rows);
  }

  /**
   * Active student IDs in a class-section for an academic year (enrolments first, legacy students fallback).
   */
  async listActiveStudentIdsForClassSection(
    filter: ClassSectionPlacementFilter,
  ): Promise<string[]> {
    const ids = await this.listActiveStudentIdsFromEnrolments(filter);
    if (ids.length > 0) return ids;
    return this.listActiveStudentIdsFromLegacyStudents(filter);
  }

  /**
   * Active students in any of the given (class_id, section_id) pairs for a year.
   */
  async listActiveStudentIdsForClassSectionPairs(
    branchId: string,
    academicYearId: string,
    pairs: Array<{ classId: string; sectionId: string }>,
  ): Promise<string[]> {
    if (pairs.length === 0) return [];

    const pairSet = new Set(pairs.map((p) => `${p.classId}:${p.sectionId}`));
    const supabase = this.supabaseConfig.getClient();

    const { data: enrolments, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('student_id, class_id, section_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');
    throwIfDbError(enrolErr);

    const fromEnrolments = [
      ...new Set(
        ((enrolments as Array<{ student_id: string; class_id: string; section_id: string }>) ?? [])
          .filter((e) => pairSet.has(`${e.class_id}:${e.section_id}`))
          .map((e) => e.student_id),
      ),
    ];
    if (fromEnrolments.length > 0) return fromEnrolments;

    const { data: legacy, error: legacyErr } = await supabase
      .from('students')
      .select('id, class_id, section_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true);
    throwIfDbError(legacyErr);

    return [
      ...new Set(
        ((legacy as Array<{ id: string; class_id: string; section_id: string }>) ?? [])
          .filter((s) => pairSet.has(`${s.class_id}:${s.section_id}`))
          .map((s) => s.id),
      ),
    ];
  }

  /**
   * Student IDs matching class/section filters for the active academic year (supports multi-class filter).
   */
  async listActiveStudentIdsForClassFilters(
    branchId: string,
    academicYearId: string,
    classIds: string[],
    sectionIds: string[],
  ): Promise<string[] | null> {
    if (classIds.length === 0 && sectionIds.length === 0) return null;

    const supabase = this.supabaseConfig.getClient();
    let query = supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');

    if (classIds.length > 0) query = query.in('class_id', classIds);
    if (sectionIds.length > 0) query = query.in('section_id', sectionIds);

    const { data, error } = await query;
    throwIfDbError(error);

    const ids = [
      ...new Set(
        ((data as Array<{ student_id: string }>) ?? []).map((r) => r.student_id).filter(Boolean),
      ),
    ];

    if (ids.length > 0) return ids;

    let legacyQuery = supabase
      .from('students')
      .select('id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true);

    if (classIds.length > 0) legacyQuery = legacyQuery.in('class_id', classIds);
    if (sectionIds.length > 0) legacyQuery = legacyQuery.in('section_id', sectionIds);

    const { data: legacyRows, error: legacyErr } = await legacyQuery;
    throwIfDbError(legacyErr);

    return [
      ...new Set(
        ((legacyRows as Array<{ id: string }>) ?? []).map((r) => r.id).filter(Boolean),
      ),
    ];
  }

  /**
   * Copy one year's enrolment onto the students row (active placement cache).
   */
  async syncStudentRowFromEnrolment(
    branchId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<boolean> {
    const supabase = this.supabaseConfig.getClient();

    const { data: enrolment, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('class_id, section_id, status')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .maybeSingle();
    throwIfDbError(enrolErr);

    if (!enrolment) return false;

    const row = enrolment as EnrolmentRow & { student_id?: string };
    const payload =
      row.status === 'active'
        ? {
            class_id: row.class_id,
            section_id: row.section_id,
            academic_year_id: academicYearId,
            updated_at: new Date().toISOString(),
          }
        : {
            class_id: null,
            section_id: null,
            academic_year_id: academicYearId,
            updated_at: new Date().toISOString(),
          };

    const { error: upErr } = await supabase
      .from('students')
      .update(payload)
      .eq('id', studentId)
      .eq('branch_id', branchId);
    throwIfDbError(upErr);
    return true;
  }

  /**
   * Batch-sync students rows from enrolments for the given year (e.g. after promotion save).
   */
  async syncStudentRowsFromEnrolments(
    branchId: string,
    academicYearId: string,
    studentIds: string[],
  ): Promise<number> {
    const unique = [...new Set(studentIds.filter(Boolean))];
    if (unique.length === 0) return 0;

    let synced = 0;
    await Promise.all(
      unique.map(async (id) => {
        const ok = await this.syncStudentRowFromEnrolment(branchId, id, academicYearId);
        if (ok) synced += 1;
      }),
    );
    return synced;
  }

  /**
   * Sync every active enrolment in a year onto students (e.g. after year lock / activate).
   */
  async syncAllActiveEnrolmentsToStudentRows(
    branchId: string,
    academicYearId: string,
  ): Promise<number> {
    const supabase = this.supabaseConfig.getClient();

    const { data: enrolments, error } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');
    throwIfDbError(error);

    const studentIds = [
      ...new Set(
        ((enrolments as Array<{ student_id: string }>) ?? []).map((e) => e.student_id),
      ),
    ];
    return this.syncStudentRowsFromEnrolments(branchId, academicYearId, studentIds);
  }

  private async listActiveStudentIdsFromEnrolments(
    filter: ClassSectionPlacementFilter,
  ): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('branch_id', filter.branchId)
      .eq('academic_year_id', filter.academicYearId)
      .eq('class_id', filter.classId)
      .eq('section_id', filter.sectionId)
      .eq('status', 'active');
    throwIfDbError(error);
    return ((data as Array<{ student_id: string }>) ?? []).map((r) => r.student_id);
  }

  private async resolveActiveAcademicYearIdForBranch(branchId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch, error: branchErr } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(branchErr);
    const tenantId = (branch as { tenant_id: string | null } | null)?.tenant_id ?? null;
    if (!tenantId) return null;

    const { data: activeUnlocked, error: auErr } = await supabase
      .from('academic_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_locked', false)
      .maybeSingle();
    throwIfDbError(auErr);
    if (activeUnlocked) return (activeUnlocked as { id: string }).id;

    const { data: newestUnlocked, error: nuErr } = await supabase
      .from('academic_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_locked', false)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfDbError(nuErr);
    return (newestUnlocked as { id: string } | null)?.id ?? null;
  }

  private async listActiveStudentIdsFromLegacyStudents(
    filter: ClassSectionPlacementFilter,
  ): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('students')
      .select('id')
      .eq('branch_id', filter.branchId)
      .eq('academic_year_id', filter.academicYearId)
      .eq('class_id', filter.classId)
      .eq('section_id', filter.sectionId)
      .eq('is_active', true);
    throwIfDbError(error);
    return ((data as Array<{ id: string }>) ?? []).map((r) => r.id);
  }
}
