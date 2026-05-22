import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import type { PostgrestError } from '@supabase/supabase-js';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  BehavioralAssessmentDto,
  BehavioralScoreDto,
} from './dto/behavioral-assessment.dto';
import { PendingStudentDto } from './dto/pending-student.dto';
import { BehavioralMatrixResponseDto } from './dto/matrix-response.dto';
import { BehavioralMatrixRowDto } from './dto/matrix-row.dto';
import { CreateBehavioralAssessmentDto } from './dto/create-behavioral-assessment.dto';
import { UpdateBehavioralAssessmentDto } from './dto/update-behavioral-assessment.dto';
import { StudentPlacementService } from '../../common/services/student-placement.service';

type BehavioralAssessmentRow = {
  id: string;
  student_id: string;
  assessed_by: string;
  assessment_month: string;
  branch_id: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

type BehavioralScoreRow = {
  id: string;
  behavioral_assessment_id: string;
  attribute_name: string;
  score: number;
  created_at: string;
};

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

/** Get first day of month as YYYY-MM-DD. */
function firstDayOfMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

@Injectable()
export class BehavioralService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly systemSettingsService: SystemSettingsService,
    private readonly studentPlacementService: StudentPlacementService,
  ) {}

  private async getBehavioralAssessmentConfig(): Promise<{
    enabled: boolean;
    mandatory: boolean;
    attributes: string[];
  }> {
    const { data } = await this.systemSettingsService.getByKey('behavioral_assessment');
    const v = data.value as { enabled?: boolean; mandatory?: boolean; attributes?: unknown } | undefined;
    const attrsRaw =
      v && typeof v === 'object' && Array.isArray((v as { attributes?: unknown }).attributes)
        ? (v as { attributes: unknown[] }).attributes
        : [];
    const attributes = [
      ...new Set(attrsRaw.map((a) => String(a).trim()).filter((a) => a.length > 0)),
    ];
    return {
      enabled: Boolean(v && typeof v === 'object' && (v as { enabled?: boolean }).enabled),
      mandatory: Boolean(v && typeof v === 'object' && (v as { mandatory?: boolean }).mandatory),
      attributes,
    };
  }

  private async isBehavioralAssessmentEnabled(): Promise<boolean> {
    const c = await this.getBehavioralAssessmentConfig();
    return c.enabled;
  }

  /** Attribute names configured for this branch (trimmed, unique). */
  private async getAllowedAttributes(): Promise<string[]> {
    const c = await this.getBehavioralAssessmentConfig();
    return c.attributes;
  }

  /**
   * Get students pending behavioral assessment this month for the current user (teacher).
   * Uses teacher_assignments and class_sections.class_teacher_id to find class sections, then students in those sections who don't have an assessment for the month.
   */
  async getPending(
    branchId: string,
    academicYearId: string,
    userId: string,
  ): Promise<{ data: PendingStudentDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    if (!(await this.isBehavioralAssessmentEnabled())) {
      return { data: [] };
    }

    const monthStr = firstDayOfMonth(new Date());

    // 1) Get staff id for user in this branch
    const { data: staffRow, error: staffErr } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();
    throwIfDbError(staffErr);
    if (!staffRow) {
      return { data: [] };
    }
    const staffId = (staffRow as { id: string }).id;

    // 2) Class section IDs: from teacher_assignments and from class_sections (class teacher)
    const [taRes, csRes] = await Promise.all([
      supabase
        .from('teacher_assignments')
        .select('class_section_id')
        .eq('staff_id', staffId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId),
      supabase
        .from('class_sections')
        .select('id')
        .eq('class_teacher_id', staffId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId),
    ]);
    throwIfDbError(taRes.error);
    throwIfDbError(csRes.error);

    const classSectionIds = new Set<string>();
    (taRes.data || []).forEach((r: { class_section_id: string }) =>
      classSectionIds.add(r.class_section_id),
    );
    (csRes.data || []).forEach((r: { id: string }) => classSectionIds.add(r.id));
    if (classSectionIds.size === 0) {
      return { data: [] };
    }

    // 3) Get class_sections to get (class_id, section_id) for each
    const { data: csList, error: csListErr } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .in('id', Array.from(classSectionIds));
    throwIfDbError(csListErr);
    const classSectionPairs = (csList || []).map(
      (cs: { class_id: string; section_id: string }) => ({
        class_id: cs.class_id,
        section_id: cs.section_id,
      }),
    );
    if (classSectionPairs.length === 0) {
      return { data: [] };
    }

    const uniqueStudentIds = await this.studentPlacementService.listActiveStudentIdsForClassSectionPairs(
      branchId,
      academicYearId,
      classSectionPairs.map((p) => ({ classId: p.class_id, sectionId: p.section_id })),
    );
    if (uniqueStudentIds.length === 0) {
      return { data: [] };
    }

    // 5) Already assessed this month by this user
    const { data: assessedRows } = await supabase
      .from('behavioral_assessments')
      .select('student_id')
      .in('student_id', uniqueStudentIds)
      .eq('assessed_by', userId)
      .eq('assessment_month', monthStr)
      .eq('branch_id', branchId);
    const assessedSet = new Set(
      (assessedRows || []).map((r: { student_id: string }) => r.student_id),
    );
    const pendingStudentIds = uniqueStudentIds.filter((id) => !assessedSet.has(id));
    if (pendingStudentIds.length === 0) {
      return { data: [] };
    }

    const { data: studentRows, error: studentErr } = await supabase
      .from('students')
      .select('id, student_id, user_id, class_id, section_id, first_name, last_name')
      .in('id', pendingStudentIds);
    throwIfDbError(studentErr);

    const classIds = [...new Set((studentRows || []).map((s: { class_id: string }) => s.class_id).filter(Boolean))];
    const sectionIds = [...new Set((studentRows || []).map((s: { section_id: string }) => s.section_id).filter(Boolean))];
    const { data: classesData } = await supabase.from('classes').select('id, display_name').in('id', classIds);
    const { data: sectionsData } = await supabase.from('sections').select('id, name').in('id', sectionIds);
    const classMap = new Map((classesData || []).map((c: { id: string; display_name: string }) => [c.id, c.display_name]));
    const sectionMap = new Map((sectionsData || []).map((s: { id: string; name: string }) => [s.id, s.name]));

    const list: PendingStudentDto[] = (studentRows || []).map(
      (s: {
        id: string;
        student_id: string;
        class_id: string | null;
        section_id: string | null;
        first_name: string | null;
        last_name: string | null;
      }) => ({
        id: s.id,
        studentId: s.student_id,
        firstName: s.first_name ?? '',
        lastName: s.last_name ?? '',
        className: s.class_id ? classMap.get(s.class_id) : undefined,
        sectionName: s.section_id ? sectionMap.get(s.section_id) : undefined,
      }),
    );
    return { data: list };
  }

  /**
   * Get behavioral history for a student (assessments with scores).
   */
  async getByStudent(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: BehavioralAssessmentDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    let activeYearId = academicYearId;
    if (!activeYearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      activeYearId = activeYear.id;
    }

    const { data: assessments, error: aErr } = await supabase
      .from('behavioral_assessments')
      .select('id, student_id, assessed_by, assessment_month, branch_id, academic_year_id, created_at, updated_at')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYearId)
      .order('assessment_month', { ascending: false });
    throwIfDbError(aErr);
    if (!assessments || assessments.length === 0) {
      return { data: [] };
    }

    const assessmentIds = (assessments as BehavioralAssessmentRow[]).map((a) => a.id);
    const { data: scoresRows, error: sErr } = await supabase
      .from('behavioral_scores')
      .select('id, behavioral_assessment_id, attribute_name, score, created_at')
      .in('behavioral_assessment_id', assessmentIds);
    throwIfDbError(sErr);

    const scoresByAssessment = new Map<string, BehavioralScoreRow[]>();
    for (const row of scoresRows || []) {
      const r = row as BehavioralScoreRow;
      const list = scoresByAssessment.get(r.behavioral_assessment_id) || [];
      list.push(r);
      scoresByAssessment.set(r.behavioral_assessment_id, list);
    }

    const dtos: BehavioralAssessmentDto[] = (assessments as BehavioralAssessmentRow[]).map(
      (a) => {
        const scoreRows = scoresByAssessment.get(a.id) || [];
        return new BehavioralAssessmentDto({
          id: a.id,
          studentId: a.student_id,
          assessedBy: a.assessed_by,
          assessmentMonth: a.assessment_month,
          branchId: a.branch_id,
          academicYearId: a.academic_year_id,
          scores: scoreRows.map(
            (s) =>
              new BehavioralScoreDto({
                id: s.id,
                attributeName: s.attribute_name,
                score: s.score,
                createdAt: s.created_at,
              }),
          ),
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        });
      },
    );
    return { data: dtos };
  }

  /**
   * Create a behavioral assessment for a student for a month.
   */
  async create(
    dto: CreateBehavioralAssessmentDto,
    userId: string,
    branchId: string,
    userEmail: string,
  ): Promise<{ data: BehavioralAssessmentDto }> {
    const supabase = this.supabaseConfig.getClient();

    const cfg = await this.getBehavioralAssessmentConfig();
    if (!cfg.enabled) {
      throw new BadRequestException('Behavioural assessment is disabled for this branch.');
    }

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }

    const allowedAttrs = await this.getAllowedAttributes();
    if (allowedAttrs.length === 0) {
      throw new BadRequestException(
        'Add at least one behavioural attribute in Settings before recording assessments.',
      );
    }
    for (const item of dto.scores) {
      if (!allowedAttrs.includes(item.attributeName)) {
        throw new BadRequestException(
          `Invalid attribute: ${item.attributeName}. Allowed: ${allowedAttrs.join(', ')}`,
        );
      }
    }

    const assessmentMonth = dto.assessmentMonth.slice(0, 10);
    const { data: existing } = await supabase
      .from('behavioral_assessments')
      .select('id')
      .eq('student_id', dto.studentId)
      .eq('assessed_by', userId)
      .eq('assessment_month', assessmentMonth)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (existing) {
      throw new ConflictException(
        'An assessment for this student and month already exists. Use update instead.',
      );
    }

    const { data: inserted, error: insErr } = await supabase
      .from('behavioral_assessments')
      .insert({
        student_id: dto.studentId,
        assessed_by: userId,
        assessment_month: assessmentMonth,
        branch_id: branchId,
        academic_year_id: activeYear.id,
      })
      .select('id, student_id, assessed_by, assessment_month, branch_id, academic_year_id, created_at, updated_at')
      .single();
    throwIfDbError(insErr);
    const row = inserted as BehavioralAssessmentRow;
    this.auditLogService
      .logCreate(
        'behavioral_assessments',
        row.id,
        userEmail,
        { ...row } as Record<string, unknown>,
        { branchId },
      )
      .catch(() => {});

    const scoreInserts = dto.scores.map((s) => ({
      behavioral_assessment_id: row.id,
      attribute_name: s.attributeName,
      score: s.score,
    }));
    const { error: scoresErr } = await supabase.from('behavioral_scores').insert(scoreInserts);
    throwIfDbError(scoresErr);

    const { data: scoreRows } = await supabase
      .from('behavioral_scores')
      .select('id, behavioral_assessment_id, attribute_name, score, created_at')
      .eq('behavioral_assessment_id', row.id);
    const scores = (scoreRows || []).map(
      (s: BehavioralScoreRow) =>
        new BehavioralScoreDto({
          id: s.id,
          attributeName: s.attribute_name,
          score: s.score,
          createdAt: s.created_at,
        }),
    );

    return {
      data: new BehavioralAssessmentDto({
        id: row.id,
        studentId: row.student_id,
        assessedBy: row.assessed_by,
        assessmentMonth: row.assessment_month,
        branchId: row.branch_id,
        academicYearId: row.academic_year_id,
        scores,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    };
  }

  /**
   * Update an existing behavioral assessment (replace scores).
   */
  async update(
    id: string,
    dto: UpdateBehavioralAssessmentDto,
    userId: string,
    branchId: string,
    userEmail: string,
  ): Promise<{ data: BehavioralAssessmentDto }> {
    const supabase = this.supabaseConfig.getClient();

    const cfg = await this.getBehavioralAssessmentConfig();
    if (!cfg.enabled) {
      throw new BadRequestException('Behavioural assessment is disabled for this branch.');
    }

    const { data: existing, error: findErr } = await supabase
      .from('behavioral_assessments')
      .select('id, student_id, assessed_by, assessment_month, branch_id, academic_year_id, created_at, updated_at')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(findErr);
    if (!existing) {
      throw new NotFoundException('Behavioral assessment not found');
    }
    const row = existing as BehavioralAssessmentRow;
    if (row.assessed_by !== userId) {
      throw new BadRequestException('You can only update your own assessments');
    }

    if (dto.scores && dto.scores.length > 0) {
      const allowedAttrs = await this.getAllowedAttributes();
      if (allowedAttrs.length === 0) {
        throw new BadRequestException(
          'Add at least one behavioural attribute in Settings before recording assessments.',
        );
      }
      for (const item of dto.scores) {
        if (!allowedAttrs.includes(item.attributeName)) {
          throw new BadRequestException(
            `Invalid attribute: ${item.attributeName}. Allowed: ${allowedAttrs.join(', ')}`,
          );
        }
      }

      await supabase.from('behavioral_scores').delete().eq('behavioral_assessment_id', id);
      const scoreInserts = dto.scores.map((s) => ({
        behavioral_assessment_id: id,
        attribute_name: s.attributeName,
        score: s.score,
      }));
      const { error: insErr } = await supabase.from('behavioral_scores').insert(scoreInserts);
      throwIfDbError(insErr);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('behavioral_assessments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, student_id, assessed_by, assessment_month, branch_id, academic_year_id, created_at, updated_at')
      .single();
    throwIfDbError(updateErr);
    const updatedRow = updated as BehavioralAssessmentRow;
    this.auditLogService
      .logUpdate(
        'behavioral_assessments',
        id,
        userEmail,
        { ...row } as Record<string, unknown>,
        { ...updatedRow } as Record<string, unknown>,
        ['updated_at'],
        { branchId },
      )
      .catch(() => {});

    const { data: scoreRows } = await supabase
      .from('behavioral_scores')
      .select('id, behavioral_assessment_id, attribute_name, score, created_at')
      .eq('behavioral_assessment_id', id);
    const scores = (scoreRows || []).map(
      (s: BehavioralScoreRow) =>
        new BehavioralScoreDto({
          id: s.id,
          attributeName: s.attribute_name,
          score: s.score,
          createdAt: s.created_at,
        }),
    );

    return {
      data: new BehavioralAssessmentDto({
        id: updatedRow.id,
        studentId: updatedRow.student_id,
        assessedBy: updatedRow.assessed_by,
        assessmentMonth: updatedRow.assessment_month,
        branchId: updatedRow.branch_id,
        academicYearId: updatedRow.academic_year_id,
        scores,
        createdAt: updatedRow.created_at,
        updatedAt: updatedRow.updated_at,
      }),
    };
  }

  /**
   * Get matrix view: students in class section with their scores for the given month.
   */
  async getMatrix(
    classSectionId: string,
    assessmentMonth: string,
    branchId: string,
    academicYearId: string,
  ): Promise<{ data: BehavioralMatrixResponseDto }> {
    const supabase = this.supabaseConfig.getClient();

    const monthStr = assessmentMonth.slice(0, 10);

    if (!(await this.isBehavioralAssessmentEnabled())) {
      return {
        data: new BehavioralMatrixResponseDto({
          attributes: [],
          rows: [],
          assessmentMonth: monthStr,
          classSectionId,
        }),
      };
    }

    const [allowedAttrsPromise, csResult] = await Promise.all([
      this.getAllowedAttributes(),
      supabase
        .from('class_sections')
        .select('id, class_id, section_id, branch_id, academic_year_id')
        .eq('id', classSectionId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .maybeSingle(),
    ]);
    throwIfDbError(csResult.error);
    const csRow = csResult.data;
    if (!csRow) {
      throw new NotFoundException('Class section not found');
    }
    const cs = csRow as {
      class_id: string;
      section_id: string;
      branch_id: string;
      academic_year_id: string;
    };

    const [classesRes, sectionsRes, rosterIds] = await Promise.all([
      supabase.from('classes').select('id, display_name').eq('id', cs.class_id).single(),
      supabase.from('sections').select('id, name').eq('id', cs.section_id).single(),
      this.studentPlacementService.listActiveStudentIdsForClassSection({
        branchId,
        academicYearId,
        classId: cs.class_id,
        sectionId: cs.section_id,
      }),
    ]);
    const className = (classesRes.data as { display_name?: string } | null)?.display_name;
    const sectionName = (sectionsRes.data as { name?: string } | null)?.name;

    const studentList =
      rosterIds.length > 0
        ? (
            (
              await supabase
                .from('students')
                .select('id, user_id')
                .in('id', rosterIds)
                .eq('branch_id', branchId)
                .eq('is_active', true)
                .order('id')
            ).data || []
          )
        : [];
    const typedStudentList = studentList as Array<{ id: string; user_id: string | null }>;
    if (typedStudentList.length === 0) {
      return {
        data: new BehavioralMatrixResponseDto({
          attributes: allowedAttrsPromise,
          rows: [],
          assessmentMonth: monthStr,
          classSectionId,
          className,
          sectionName,
        }),
      };
    }

    const userIds = typedStudentList.map((s) => s.user_id).filter(Boolean) as string[];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
    );

    const studentIds = typedStudentList.map((s) => s.id);
    const { data: assessments } = await supabase
      .from('behavioral_assessments')
      .select('id, student_id')
      .in('student_id', studentIds)
      .eq('assessment_month', monthStr)
      .eq('branch_id', branchId);
    const assessmentByStudent = new Map(
      (assessments || []).map((a: { id: string; student_id: string }) => [a.student_id, a.id]),
    );
    const assessmentIds = [...assessmentByStudent.values()];

    let scoreRows: BehavioralScoreRow[] = [];
    if (assessmentIds.length > 0) {
      const { data: scores } = await supabase
        .from('behavioral_scores')
        .select('id, behavioral_assessment_id, attribute_name, score, created_at')
        .in('behavioral_assessment_id', assessmentIds);
      scoreRows = (scores || []) as BehavioralScoreRow[];
    }

    const assessmentIdToScores = new Map<string, Record<string, number>>();
    const allAttributes = new Set<string>();
    for (const s of scoreRows) {
      const assessmentId = s.behavioral_assessment_id;
      let map = assessmentIdToScores.get(assessmentId);
      if (!map) {
        map = {};
        assessmentIdToScores.set(assessmentId, map);
      }
      map[s.attribute_name] = s.score;
      allAttributes.add(s.attribute_name);
    }
    const attributes =
      allowedAttrsPromise.length > 0 ? allowedAttrsPromise : Array.from(allAttributes).sort();

    const studentIdToAssessmentId = new Map<string, string>();
    assessmentByStudent.forEach((aid, sid) => studentIdToAssessmentId.set(sid, aid));

    const rows: BehavioralMatrixRowDto[] = typedStudentList.map((s) => {
      const assessmentId = studentIdToAssessmentId.get(s.id);
      const scoresMap = assessmentId
        ? assessmentIdToScores.get(assessmentId) || {}
        : {};
      return new BehavioralMatrixRowDto({
        studentId: s.id,
        studentName: profileMap.get(s.user_id || '') || 'Unknown',
        assessmentId,
        scores: scoresMap,
      });
    });

    return {
      data: new BehavioralMatrixResponseDto({
        attributes,
        rows,
        assessmentMonth: monthStr,
        classSectionId,
        className,
        sectionName,
      }),
    };
  }
}
