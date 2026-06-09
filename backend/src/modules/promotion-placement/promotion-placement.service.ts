import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { StudentPlacementService } from '../../common/services/student-placement.service';
import { PromotionStudentDto } from './dto/promotion-student.dto';
import type { PromotionOutcome } from './dto/promotion-outcome.enum';
import { YearCloseReadinessDto } from './dto/year-close-readiness.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type EnrolmentRow = {
  student_id: string;
  class_id: string | null;
  section_id: string | null;
  status?: string;
};

@Injectable()
export class PromotionPlacementService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly studentPlacementService: StudentPlacementService,
  ) {}

  async listStudentsForPromotion(
    branchId: string,
    academicYearId: string,
    classSectionId?: string,
  ): Promise<{ data: PromotionStudentDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    // Filter by a class-section if provided (derive class_id, section_id from it)
    let classId: string | null = null;
    let sectionId: string | null = null;
    if (classSectionId) {
      const { data: cs, error: csError } = await supabase
        .from('class_sections')
        .select('id, class_id, section_id, academic_year_id')
        .eq('id', classSectionId)
        .eq('branch_id', branchId)
        .maybeSingle();
      throwIfDbError(csError);
      if (!cs) throw new NotFoundException('Class-section not found');
      const csRow = cs as { class_id: string; section_id: string; academic_year_id: string };
      if (csRow.academic_year_id !== academicYearId) {
        throw new BadRequestException('Class-section does not belong to the selected academic year');
      }
      classId = csRow.class_id;
      sectionId = csRow.section_id;
    }

    const terminalStatuses = [
      'graduated',
      'transferred_out',
      'withdrawn',
      'inactive',
    ] as const;

    // Active enrolments (pending decisions) plus terminal outcomes (already decided).
    let activeQuery = supabase
      .from('student_enrolments')
      .select('student_id, class_id, section_id, status')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');

    let terminalQuery = supabase
      .from('student_enrolments')
      .select('student_id, class_id, section_id, status')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .in('status', [...terminalStatuses]);

    if (classId) {
      activeQuery = activeQuery.eq('class_id', classId);
      terminalQuery = terminalQuery.eq('class_id', classId);
    }
    if (sectionId) {
      activeQuery = activeQuery.eq('section_id', sectionId);
      terminalQuery = terminalQuery.eq('section_id', sectionId);
    }

    const [{ data: activeEnrolments, error: activeErr }, { data: terminalEnrolments, error: terminalErr }] =
      await Promise.all([activeQuery, terminalQuery]);
    throwIfDbError(activeErr);
    throwIfDbError(terminalErr);

    const enrolmentByStudent = new Map<string, EnrolmentRow>();
    for (const row of [
      ...((activeEnrolments as EnrolmentRow[]) ?? []),
      ...((terminalEnrolments as EnrolmentRow[]) ?? []),
    ]) {
      enrolmentByStudent.set(row.student_id, row);
    }
    const enrolmentRows = [...enrolmentByStudent.values()];
    const studentIds = enrolmentRows.map((e) => e.student_id);

    if (studentIds.length === 0) {
      return { data: [] };
    }

    // Fetch student display fields
    const { data: students, error: stErr } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name')
      .in('id', studentIds)
      .eq('branch_id', branchId);
    throwIfDbError(stErr);
    const studentMap = new Map(
      ((students as Array<{ id: string; student_id: string; first_name: string | null; last_name: string | null }>) ?? []).map(
        (s) => [
          s.id,
          { studentId: s.student_id, firstName: s.first_name ?? undefined, lastName: s.last_name ?? undefined },
        ],
      ),
    );

    // Fetch existing decisions for this closing year
    const { data: decisions, error: dErr } = await supabase
      .from('student_promotion_decisions')
      .select('student_id, outcome, target_class_id, target_section_id')
      .eq('branch_id', branchId)
      .eq('source_academic_year_id', academicYearId)
      .in('student_id', studentIds);
    throwIfDbError(dErr);
    const decisionMap = new Map<
      string,
      { outcome: PromotionOutcome; targetClassId: string | null; targetSectionId: string | null }
    >(
      ((decisions as any[]) ?? []).map((r) => [
        r.student_id,
        {
          outcome: r.outcome as PromotionOutcome,
          targetClassId: r.target_class_id ?? null,
          targetSectionId: r.target_section_id ?? null,
        },
      ]),
    );

    const results = enrolmentRows.map((e) => {
      const student = studentMap.get(e.student_id);
      const decision = decisionMap.get(e.student_id);
      return new PromotionStudentDto({
        id: e.student_id,
        studentId: student?.studentId ?? e.student_id,
        firstName: student?.firstName,
        lastName: student?.lastName,
        classId: e.class_id ?? undefined,
        sectionId: e.section_id ?? undefined,
        classSectionId: classSectionId ?? undefined,
        decisionOutcome: decision?.outcome,
        targetClassId: decision?.targetClassId ?? undefined,
        targetSectionId: decision?.targetSectionId ?? undefined,
      });
    });

    return { data: results };
  }

  async saveDecisions(
    branchId: string,
    sourceAcademicYearId: string,
    decidedByUserId: string,
    decisions: Array<{
      studentId: string;
      outcome: PromotionOutcome;
      targetClassId?: string | null;
      targetSectionId?: string | null;
    }>,
  ): Promise<{ upserted: number }> {
    const supabase = this.supabaseConfig.getClient();

    await this.academicYearsService.assertNotLockedForBranch(branchId, sourceAcademicYearId);

    if (decisions.length === 0) return { upserted: 0 };

    const studentIds = [...new Set(decisions.map((d) => d.studentId))];
    const { data: enrolments, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('student_id, status')
      .eq('branch_id', branchId)
      .eq('academic_year_id', sourceAcademicYearId)
      .in('student_id', studentIds);
    throwIfDbError(enrolErr);

    const allowedStatuses = new Set([
      'active',
      'graduated',
      'transferred_out',
      'withdrawn',
      'inactive',
    ]);
    const enrolledSet = new Set(
      ((enrolments as Array<{ student_id: string; status: string }>) ?? [])
        .filter((r) => allowedStatuses.has(r.status))
        .map((r) => r.student_id),
    );
    const invalid = studentIds.filter((id) => !enrolledSet.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        'One or more students are not enrolled in this academic year',
      );
    }

    // Validate target fields
    for (const d of decisions) {
      if (d.outcome === 'promoted' || d.outcome === 'repeated') {
        if (!d.targetClassId || !d.targetSectionId) {
          throw new BadRequestException('Target class and section are required for promoted/repeated outcomes');
        }
      }
    }

    const now = new Date().toISOString();
    const rows = decisions.map((d) => ({
      student_id: d.studentId,
      branch_id: branchId,
      source_academic_year_id: sourceAcademicYearId,
      outcome: d.outcome,
      target_class_id: d.targetClassId ?? null,
      target_section_id: d.targetSectionId ?? null,
      decided_by: decidedByUserId,
      decided_at: now,
      updated_at: now,
    }));

    const { error } = await supabase.from('student_promotion_decisions').upsert(rows, {
      onConflict: 'student_id,branch_id,source_academic_year_id',
    });
    throwIfDbError(error);

    await this.studentPlacementService.applyPromotionDecisionsToClosingYearEnrolments(
      branchId,
      sourceAcademicYearId,
    );

    return { upserted: rows.length };
  }

  async getReadiness(branchId: string, academicYearId: string): Promise<YearCloseReadinessDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: activeEnrolments, error: eErr } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');
    throwIfDbError(eErr);
    const activeStudentIds = ((activeEnrolments as Array<{ student_id: string }>) ?? []).map((r) => r.student_id);

    if (activeStudentIds.length === 0) {
      return new YearCloseReadinessDto({
        academicYearId,
        totalActiveStudents: 0,
        decisionsCompleted: 0,
        decisionsMissing: 0,
        missingStudentIds: [],
      });
    }

    const { data: decisions, error: dErr } = await supabase
      .from('student_promotion_decisions')
      .select('student_id')
      .eq('branch_id', branchId)
      .eq('source_academic_year_id', academicYearId)
      .in('student_id', activeStudentIds);
    throwIfDbError(dErr);
    const decidedSet = new Set(((decisions as Array<{ student_id: string }>) ?? []).map((r) => r.student_id));

    const missing = activeStudentIds.filter((id) => !decidedSet.has(id));
    return new YearCloseReadinessDto({
      academicYearId,
      totalActiveStudents: activeStudentIds.length,
      decisionsCompleted: activeStudentIds.length - missing.length,
      decisionsMissing: missing.length,
      missingStudentIds: missing,
    });
  }
}

