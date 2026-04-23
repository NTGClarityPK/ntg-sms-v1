import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { AcademicYearDto } from './dto/academic-year.dto';
import { QueryAcademicYearsDto } from './dto/query-academic-years.dto';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';

type AcademicYearRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
};

function mapAcademicYear(row: AcademicYearRow): AcademicYearDto {
  return new AcademicYearDto({
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
    isLocked: row.is_locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  const raw = error.message || 'Database error';
  const looksLikeHtml = typeof raw === 'string' && raw.trim().startsWith('<!DOCTYPE html');
  const message = looksLikeHtml ? 'Database temporarily unavailable. Please try again.' : raw;
  if (looksLikeHtml) {
    throw new ServiceUnavailableException(message);
  }
  throw new BadRequestException(message);
}

@Injectable()
export class AcademicYearsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Resolve tenant_id for a branch. Used by branch-scoped modules.
   */
  private async getTenantIdForBranch(branchId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branchRow, error: branchError } = await supabase
      .from('branches')
      .select('tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    throwIfDbError(branchError);
    return (branchRow as { tenant_id: string | null } | null)?.tenant_id ?? null;
  }

  async list(
    query: QueryAcademicYearsDto,
    tenantId: string | null,
    branchId?: string | null,
  ): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    let dbQuery = supabase
      .from('academic_years')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.search) {
      // Search by name (case-insensitive)
      dbQuery = dbQuery.ilike('name', `%${query.search}%`);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const years = (data as AcademicYearRow[]).map(mapAcademicYear);
    const yearIdToName = new Map(years.map((y) => [y.id, y.name]));

    // Add rollover summary (if rollover has been completed for a target year in this branch)
    const yearIds = years.map((y) => y.id);
    if (branchId && yearIds.length > 0) {
      const { data: rollovers, error: rErr } = await supabase
        .from('academic_year_rollovers')
        .select('source_academic_year_id, target_academic_year_id, carry_forward, result, created_at')
        .eq('branch_id', branchId)
        .in('target_academic_year_id', yearIds);
      throwIfDbError(rErr);

      const byTargetId = new Map<
        string,
        {
          sourceAcademicYearId: string;
          completedAt: string;
          carryForward: Record<string, unknown>;
          result: Record<string, unknown>;
        }
      >();
      for (const r of (rollovers || []) as Array<{
        source_academic_year_id: string;
        target_academic_year_id: string;
        carry_forward: Record<string, unknown> | null;
        result: Record<string, unknown> | null;
        created_at: string;
      }>) {
        byTargetId.set(r.target_academic_year_id, {
          sourceAcademicYearId: r.source_academic_year_id,
          completedAt: r.created_at,
          carryForward: r.carry_forward ?? {},
          result: r.result ?? {},
        });
      }

      const sourceIdsForNames = [...new Set([...byTargetId.values()].map((v) => v.sourceAcademicYearId))];
      const sourceIdsMissingName = sourceIdsForNames.filter((id) => !yearIdToName.has(id));
      if (sourceIdsMissingName.length > 0) {
        const { data: nameRows, error: nameErr } = await supabase
          .from('academic_years')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .in('id', sourceIdsMissingName);
        throwIfDbError(nameErr);
        for (const row of (nameRows ?? []) as Array<{ id: string; name: string }>) {
          yearIdToName.set(row.id, row.name);
        }
      }

      for (const y of years) {
        const r = byTargetId.get(y.id);
        if (!r) continue;
        const cf = r.carryForward;
        const res = r.result;
        y.rollover = {
          sourceAcademicYearId: r.sourceAcademicYearId,
          sourceAcademicYearName: yearIdToName.get(r.sourceAcademicYearId),
          completedAt: r.completedAt,
          carryForward: {
            teacherAssignments: cf.teacherAssignments === true,
            timetableSlots: cf.timetableSlots === true,
            leaveSettings: cf.leaveSettings === true,
          },
          result: {
            classSectionsCopied: typeof res.classSectionsCopied === 'number' ? res.classSectionsCopied : Number(res.classSectionsCopied ?? 0),
            teacherAssignmentsCopied:
              typeof res.teacherAssignmentsCopied === 'number'
                ? res.teacherAssignmentsCopied
                : Number(res.teacherAssignmentsCopied ?? 0),
            timetableSlotsCopied:
              typeof res.timetableSlotsCopied === 'number' ? res.timetableSlotsCopied : Number(res.timetableSlotsCopied ?? 0),
            leaveSettingsCopied:
              typeof res.leaveSettingsCopied === 'number' ? res.leaveSettingsCopied : Number(res.leaveSettingsCopied ?? 0),
          },
        };
      }
    }

    return {
      data: years,
      meta: { total, page, limit, totalPages },
    };
  }

  async getActive(tenantId: string | null): Promise<AcademicYearDto | null> {
    const supabase = this.supabaseConfig.getClient();
    // Prefer an active, unlocked year.
    // A locked year should never remain "active", but some tenants can drift into that state.
    const { data: activeUnlocked, error: auErr } = await supabase
      .from('academic_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_locked', false)
      .maybeSingle();
    throwIfDbError(auErr);
    if (activeUnlocked) return mapAcademicYear(activeUnlocked as AcademicYearRow);

    // Fallback: no active unlocked year found. Choose the most recent unlocked year so the app can continue.
    const { data: newestUnlocked, error: nuErr } = await supabase
      .from('academic_years')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_locked', false)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfDbError(nuErr);
    return newestUnlocked ? mapAcademicYear(newestUnlocked as AcademicYearRow) : null;
  }

  /**
   * Convenience helper for branch-scoped modules that only have branchId.
   * Resolves tenant_id via branches, then returns that tenant's active academic year.
   */
  async getActiveForBranch(branchId: string): Promise<AcademicYearDto | null> {
    const tenantId = await this.getTenantIdForBranch(branchId);
    return this.getActive(tenantId);
  }

  /**
   * Enforce that a given academic year is not locked (branch-scoped).
   * Call this before any write operation that targets `academic_year_id`.
   */
  async assertNotLockedForBranch(branchId: string, academicYearId: string): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const tenantId = await this.getTenantIdForBranch(branchId);

    const { data, error } = await supabase
      .from('academic_years')
      .select('id, is_locked')
      .eq('id', academicYearId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    throwIfDbError(error);

    if (!data) {
      throw new NotFoundException('Academic year not found');
    }
    if ((data as { is_locked: boolean }).is_locked) {
      throw new BadRequestException(
        'This academic year is locked. Switch to the active academic year or contact support.',
      );
    }
  }

  async rolloverAcademicYear(input: {
    branchId: string;
    tenantId: string | null;
    sourceAcademicYearId: string;
    targetAcademicYearId: string;
    carryForward?: {
      classSections?: boolean;
      teacherAssignments?: boolean;
      timetableSlots?: boolean;
      leaveSettings?: boolean;
    };
    userId: string;
    userEmail: string;
  }): Promise<{
    classSectionsCopied: number;
    teacherAssignmentsCopied: number;
    timetableSlotsCopied: number;
    leaveSettingsCopied: number;
  }> {
    const supabase = this.supabaseConfig.getClient();

    // Rollover should only be allowed once per target academic year (per branch).
    const { data: existingRollover, error: exErr } = await supabase
      .from('academic_year_rollovers')
      .select('id')
      .eq('branch_id', input.branchId)
      .eq('target_academic_year_id', input.targetAcademicYearId)
      .maybeSingle();
    throwIfDbError(exErr);
    if (existingRollover) {
      throw new BadRequestException('Rollover has already been completed for this academic year');
    }

    if (input.sourceAcademicYearId === input.targetAcademicYearId) {
      throw new BadRequestException('Target academic year must be different from the source academic year');
    }

    // Ensure source year exists for tenant
    const { data: sourceYear, error: sourceErr } = await supabase
      .from('academic_years')
      .select('id, is_locked')
      .eq('id', input.sourceAcademicYearId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    throwIfDbError(sourceErr);
    if (!sourceYear) throw new NotFoundException('Academic year not found');

    const sourceIsLocked = (sourceYear as { is_locked: boolean }).is_locked;

    // Ensure target year exists for tenant and is not locked
    const { data: targetYear, error: targetErr } = await supabase
      .from('academic_years')
      .select('id, is_locked')
      .eq('id', input.targetAcademicYearId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle();
    throwIfDbError(targetErr);
    if (!targetYear) throw new NotFoundException('Target academic year not found');
    if ((targetYear as { is_locked: boolean }).is_locked) {
      throw new BadRequestException('Target academic year is locked');
    }

    // Ensure target year is active for the tenant (idempotent).
    // (This also supports "copy into currently-active year" flows.)
    await this.activate(input.targetAcademicYearId, input.tenantId, input.userEmail);

    const carry = {
      teacherAssignments: input.carryForward?.teacherAssignments ?? false,
      timetableSlots: input.carryForward?.timetableSlots ?? false,
      leaveSettings: input.carryForward?.leaveSettings ?? true,
    };

    // 1) Copy class_sections for source->target (preserve class/section/capacity/teacher/is_active)
    let classSectionsCopied = 0;
    const sourceToTargetClassSectionId = new Map<string, string>();
    // Class sections are a year-scoped table in this system.
    // However, we do NOT expose "copy class sections" in rollover UI to avoid confusion:
    // copying class-sections without applying enrolments makes rosters appear empty.
    // Rollover may still rely on class-sections existing in the target year; ensure they're created via other setup flows.
    {
      const { data: sourceSections, error: csErr } = await supabase
        .from('class_sections')
        .select('id, class_id, section_id, capacity, is_active, class_teacher_id')
        .eq('branch_id', input.branchId)
        .eq('academic_year_id', input.sourceAcademicYearId);
      throwIfDbError(csErr);

      const rows = (sourceSections as Array<{
        id: string;
        class_id: string;
        section_id: string;
        capacity: number;
        is_active: boolean;
        class_teacher_id: string | null;
      }>) ?? [];

      if (rows.length > 0) {
        const insertRows = rows.map((r) => ({
          class_id: r.class_id,
          section_id: r.section_id,
          branch_id: input.branchId,
          academic_year_id: input.targetAcademicYearId,
          capacity: r.capacity,
          is_active: r.is_active,
          class_teacher_id: r.class_teacher_id,
          created_by: extractUsernameFromEmail(input.userEmail),
          updated_by: extractUsernameFromEmail(input.userEmail),
        }));

        // Use upsert so rollover is safe to re-run (or run after manual setup).
        const { data: inserted, error: insErr } = await supabase
          .from('class_sections')
          .upsert(insertRows, { onConflict: 'class_id,section_id,branch_id,academic_year_id' })
          .select('id, class_id, section_id');
        throwIfDbError(insErr);
        const insertedRows = (inserted as Array<{ id: string; class_id: string; section_id: string }>) ?? [];

        classSectionsCopied = insertedRows.length;

        // Build mapping by (class_id, section_id)
        const key = (c: string, s: string) => `${c}::${s}`;
        const targetMap = new Map(insertedRows.map((r) => [key(r.class_id, r.section_id), r.id]));
        for (const src of rows) {
          const targetId = targetMap.get(key(src.class_id, src.section_id));
          if (targetId) sourceToTargetClassSectionId.set(src.id, targetId);
        }
      }
    }

    // 2) Copy teacher_assignments (map class_section_id through the new ids)
    let teacherAssignmentsCopied = 0;
    if (carry.teacherAssignments) {
      const { data: sourceAssignments, error: taErr } = await supabase
        .from('teacher_assignments')
        .select('staff_id, subject_id, class_section_id')
        .eq('branch_id', input.branchId)
        .eq('academic_year_id', input.sourceAcademicYearId);
      throwIfDbError(taErr);

      const rows = (sourceAssignments as Array<{ staff_id: string; subject_id: string; class_section_id: string }>) ?? [];
      const toInsert = rows
        .map((r) => {
          const targetClassSectionId = sourceToTargetClassSectionId.get(r.class_section_id);
          if (!targetClassSectionId) return null;
          return {
            staff_id: r.staff_id,
            subject_id: r.subject_id,
            class_section_id: targetClassSectionId,
            academic_year_id: input.targetAcademicYearId,
            branch_id: input.branchId,
            created_by: extractUsernameFromEmail(input.userEmail),
            updated_by: extractUsernameFromEmail(input.userEmail),
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);

      if (toInsert.length > 0) {
        const { error } = await supabase.from('teacher_assignments').insert(toInsert);
        throwIfDbError(error);
        teacherAssignmentsCopied = toInsert.length;
      }
    }

    // 3) Copy timetable_slots (map class_section_id)
    let timetableSlotsCopied = 0;
    if (carry.timetableSlots) {
      const { data: sourceSlots, error: tsErr } = await supabase
        .from('timetable_slots')
        .select(
          'class_section_id, day_of_week, period_number, start_time, end_time, subject_id, staff_id, room, slot_type, subject_template_id',
        )
        .eq('branch_id', input.branchId)
        .eq('academic_year_id', input.sourceAcademicYearId);
      throwIfDbError(tsErr);

      const rows =
        (sourceSlots as Array<{
          class_section_id: string;
          day_of_week: number;
          period_number: number | null;
          start_time: string;
          end_time: string;
          subject_id: string | null;
          staff_id: string | null;
          room: string | null;
          slot_type: string;
          subject_template_id: string | null;
        }>) ?? [];

      const toInsert = rows
        .map((r) => {
          const targetClassSectionId = sourceToTargetClassSectionId.get(r.class_section_id);
          if (!targetClassSectionId) return null;
          return {
            class_section_id: targetClassSectionId,
            day_of_week: r.day_of_week,
            period_number: r.period_number,
            start_time: r.start_time,
            end_time: r.end_time,
            subject_id: r.subject_id,
            staff_id: r.staff_id,
            room: r.room,
            slot_type: r.slot_type,
            branch_id: input.branchId,
            academic_year_id: input.targetAcademicYearId,
            subject_template_id: r.subject_template_id,
            created_by: extractUsernameFromEmail(input.userEmail),
            updated_by: extractUsernameFromEmail(input.userEmail),
          };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);

      if (toInsert.length > 0) {
        const { error } = await supabase.from('timetable_slots').insert(toInsert);
        throwIfDbError(error);
        timetableSlotsCopied = toInsert.length;
      }
    }

    // 4) Copy leave_settings (annual quota) from source->target
    let leaveSettingsCopied = 0;
    if (carry.leaveSettings) {
      const { data: src, error: lsErr } = await supabase
        .from('leave_settings')
        .select('annual_quota')
        .eq('academic_year_id', input.sourceAcademicYearId)
        .maybeSingle();
      throwIfDbError(lsErr);
      if (src) {
        const { error } = await supabase.from('leave_settings').upsert(
          {
            annual_quota: (src as { annual_quota: number }).annual_quota,
            academic_year_id: input.targetAcademicYearId,
            updated_by: extractUsernameFromEmail(input.userEmail),
          },
          { onConflict: 'academic_year_id' },
        );
        throwIfDbError(error);
        leaveSettingsCopied = 1;
      }
    }

    // Lock source year if it wasn't already locked (supports "wizard locks old year" flow).
    if (!sourceIsLocked) {
      await this.lock(input.sourceAcademicYearId, input.tenantId, input.branchId, input.userEmail);
    }

    // Ensure student placement exists for the target year based on the source year's promotion decisions/enrolments.
    // This is critical when copying class sections into a "fresh" year: without enrolments, many screens will show
    // "no students" for the copied class-sections.
    await this.applyPromotionDecisionsToEnrolments({
      branchId: input.branchId,
      sourceAcademicYearId: input.sourceAcademicYearId,
      targetAcademicYearId: input.targetAcademicYearId,
      userEmail: input.userEmail,
    });

    const result = {
      classSectionsCopied,
      teacherAssignmentsCopied,
      timetableSlotsCopied,
      leaveSettingsCopied,
    };

    // Persist rollover completion so the UI can disable rollover for this target year.
    const { error: insErr } = await supabase.from('academic_year_rollovers').insert({
      branch_id: input.branchId,
      source_academic_year_id: input.sourceAcademicYearId,
      target_academic_year_id: input.targetAcademicYearId,
      carry_forward: carry,
      result,
      created_by: extractUsernameFromEmail(input.userEmail),
    });
    throwIfDbError(insErr);

    return result;
  }

  async create(
    input: { name: string; startDate: string; endDate: string },
    tenantId: string | null,
    userEmail: string,
  ): Promise<AcademicYearDto> {
    if (input.startDate >= input.endDate) {
      throw new BadRequestException('startDate must be before endDate');
    }

    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    // If there is already an active, unlocked year for this tenant, new year should be created inactive by default.
    const { data: existingActive, error: activeErr } = await supabase
      .from('academic_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_locked', false)
      .maybeSingle();
    throwIfDbError(activeErr);
    const shouldBeActive = !existingActive;

    // Idempotent behaviour: if a year with the same name already exists for this tenant, return it.
    if (tenantId) {
      const { data: existing, error: existingError } = await supabase
        .from('academic_years')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('name', input.name)
        .maybeSingle();
      throwIfDbError(existingError);
      if (existing) return mapAcademicYear(existing as AcademicYearRow);
    }

    const { data, error } = await supabase
      .from('academic_years')
      .insert({
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
        is_active: shouldBeActive,
        is_locked: false,
        tenant_id: tenantId,
        created_by: username,
        updated_by: username,
      })
      .select('*')
      .single();

    throwIfDbError(error);
    const row = data as AcademicYearRow;
    this.auditLogService
      .logCreate('academic_years', row.id, userEmail, { ...row } as Record<string, unknown>, {
        tenantId,
      })
      .catch(() => {});
    return mapAcademicYear(row);
  }

  async activate(id: string, tenantId: string | null, userEmail: string): Promise<AcademicYearDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    // Ensure it exists and not locked
    const { data: existing, error: existingError } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (existingError || !existing) throw new NotFoundException('Academic year not found');
    if ((existing as AcademicYearRow).is_locked) throw new BadRequestException('Academic year is locked');

    // Deactivate all, then activate selected (service role key bypasses RLS)
    const { error: deactivateError } = await supabase
      .from('academic_years')
      .update({ is_active: false, updated_by: username })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    throwIfDbError(deactivateError);

    const { data, error } = await supabase
      .from('academic_years')
      .update({ is_active: true, updated_by: username })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    throwIfDbError(error);
    const newRow = data as AcademicYearRow;
    this.auditLogService
      .logUpdate(
        'academic_years',
        id,
        userEmail,
        { ...existing } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        ['is_active', 'updated_by'],
        { tenantId },
      )
      .catch(() => {});
    return mapAcademicYear(newRow);
  }

  /**
   * Apply Promotion decisions (source year) into enrolments (target year).
   * This is branch-scoped because enrolments are branch-scoped.
   *
   * Behaviour:
   * - For students with a promotion decision, create/update `student_enrolments` for the target year:
   *   - promoted/repeated → status=active + target class/section
   *   - graduated/transferred_out/withdrawn/inactive → matching status (no class/section required)
   * - For students without a decision (should be rare if gating is followed), copy their source-year enrolment as-is.
   *
   * Idempotent via unique constraint on (student_id, branch_id, academic_year_id).
   */
  async applyPromotionDecisionsToEnrolments(input: {
    branchId: string;
    sourceAcademicYearId: string;
    targetAcademicYearId: string;
    userEmail: string;
  }): Promise<{ upserted: number }> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(input.userEmail);

    const { data: sourceEnrolments, error: eErr } = await supabase
      .from('student_enrolments')
      .select('student_id, class_id, section_id, status')
      .eq('branch_id', input.branchId)
      .eq('academic_year_id', input.sourceAcademicYearId);
    throwIfDbError(eErr);

    const { data: decisions, error: dErr } = await supabase
      .from('student_promotion_decisions')
      .select('student_id, outcome, target_class_id, target_section_id')
      .eq('branch_id', input.branchId)
      .eq('source_academic_year_id', input.sourceAcademicYearId);
    throwIfDbError(dErr);

    // Fallback: some tenants may still have legacy placement only on students table.
    // Pull a baseline roster from students so we can create target-year enrolments even if source enrolments are missing.
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, class_id, section_id, is_active')
      .eq('branch_id', input.branchId)
      .eq('is_active', true);
    throwIfDbError(stErr);

    const baselineByStudentId = new Map<string, { classId: string | null; sectionId: string | null; status: string }>();
    for (const row of (students || []) as Array<{ id: string; class_id: string | null; section_id: string | null }>) {
      baselineByStudentId.set(row.id, { classId: row.class_id ?? null, sectionId: row.section_id ?? null, status: 'active' });
    }
    for (const row of (sourceEnrolments || []) as Array<{ student_id: string; class_id: string | null; section_id: string | null; status: string }>) {
      baselineByStudentId.set(row.student_id, {
        classId: row.class_id ?? null,
        sectionId: row.section_id ?? null,
        status: row.status ?? 'active',
      });
    }

    const decisionByStudentId = new Map<
      string,
      { outcome: string; targetClassId: string | null; targetSectionId: string | null }
    >(
      ((decisions as any[]) ?? []).map((r) => [
        r.student_id,
        {
          outcome: r.outcome,
          targetClassId: r.target_class_id ?? null,
          targetSectionId: r.target_section_id ?? null,
        },
      ]),
    );

    const rows = Array.from(baselineByStudentId.entries()).map(([studentId, baseline]) => {
      const decision = decisionByStudentId.get(studentId);

      // Default: copy baseline as-is (for missing decisions)
      let status: string = baseline.status || 'active';
      let classId: string | null = baseline.classId ?? null;
      let sectionId: string | null = baseline.sectionId ?? null;

      if (decision) {
        const outcome = decision.outcome;
        if (outcome === 'promoted' || outcome === 'repeated') {
          status = 'active';
          classId = decision.targetClassId;
          sectionId = decision.targetSectionId;
        } else {
          status = outcome; // graduated/transferred_out/withdrawn/inactive
          classId = null;
          sectionId = null;
        }
      }

      return {
        student_id: studentId,
        branch_id: input.branchId,
        academic_year_id: input.targetAcademicYearId,
        class_id: classId,
        section_id: sectionId,
        status,
        updated_by: username,
      };
    });

    if (rows.length === 0) return { upserted: 0 };

    const { error: upErr } = await supabase.from('student_enrolments').upsert(rows, {
      onConflict: 'student_id,branch_id,academic_year_id',
    });
    throwIfDbError(upErr);
    return { upserted: rows.length };
  }

  async lock(id: string, tenantId: string | null, branchId: string, userEmail: string): Promise<AcademicYearDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    const { data: existing, error: existingError } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (existingError || !existing) throw new NotFoundException('Academic year not found');

    // Require that another (unlocked) academic year exists to switch into.
    const { data: nextYear, error: nextErr } = await supabase
      .from('academic_years')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_locked', false)
      .neq('id', id)
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    throwIfDbError(nextErr);
    if (!nextYear) {
      throw new BadRequestException('Please create a new academic year before locking the current academic year');
    }

    const { data, error } = await supabase
      .from('academic_years')
      .update({ is_locked: true, updated_by: username })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    throwIfDbError(error);
    const newRow = data as AcademicYearRow;
    this.auditLogService
      .logUpdate(
        'academic_years',
        id,
        userEmail,
        { ...existing } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        ['is_locked', 'updated_by'],
        { tenantId },
      )
      .catch(() => {});

    // Automatically activate the next available year after locking.
    const nextYearId = (nextYear as { id: string }).id;
    await this.activate(nextYearId, tenantId, userEmail);

    // Same as PATCH activate: copy promotion decisions into enrolments for the newly active year.
    // (Controller activate does this; service-level lock previously skipped it, which left class/section as empty for the new year.)
    await this.applyPromotionDecisionsToEnrolments({
      branchId,
      sourceAcademicYearId: id,
      targetAcademicYearId: nextYearId,
      userEmail,
    });

    return mapAcademicYear(newRow);
  }

  async unlock(id: string, tenantId: string | null, userEmail: string): Promise<AcademicYearDto> {
    const supabase = this.supabaseConfig.getClient();
    const username = extractUsernameFromEmail(userEmail);

    const { data: existing, error: existingError } = await supabase
      .from('academic_years')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (existingError || !existing) throw new NotFoundException('Academic year not found');
    if (!(existing as AcademicYearRow).is_locked) {
      throw new BadRequestException('Academic year is not locked');
    }

    const { data, error } = await supabase
      .from('academic_years')
      .update({ is_locked: false, updated_by: username })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    throwIfDbError(error);
    const newRow = data as AcademicYearRow;
    this.auditLogService
      .logUpdate(
        'academic_years',
        id,
        userEmail,
        { ...existing } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        ['is_locked', 'updated_by'],
        { tenantId },
      )
      .catch(() => {});
    return mapAcademicYear(newRow);
  }
}


