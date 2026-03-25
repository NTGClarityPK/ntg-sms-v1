import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import archiver from 'archiver';
import puppeteer from 'puppeteer';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { BehavioralService } from '../behavioral/behavioral.service';
import { StudentResultDto } from './dto/student-result.dto';
import { ResultSubjectDto } from './dto/result-subject.dto';
import { ClassSectionResultsDto } from './dto/class-section-results.dto';
import { ResultCardDto } from './dto/result-card.dto';
import { DetailedStudentResultDto } from './dto/detailed-student-result.dto';
import { AssessmentWiseEntryDto } from './dto/assessment-wise-entry.dto';
import type { ResultType } from './dto/result-type.enum';

type GradeRangeRow = { letter: string; min_percentage: number; max_percentage: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type BehavioralPeriod = { period: string; attributes: { attributeName: string; average: number }[] };

function getPuppeteerExecutablePath(): string | undefined {
  return (
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined
  );
}

@Injectable()
export class ResultsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly behavioralService: BehavioralService,
  ) {}

  private async getLetterGradeRanges(classId: string): Promise<GradeRangeRow[] | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data: cga, error: cgaErr } = await supabase
      .from('class_grade_assignments')
      .select('grade_template_id')
      .eq('class_id', classId)
      .maybeSingle();
    throwIfDbError(cgaErr);
    if (!cga) return null;
    const { data: ranges, error: rErr } = await supabase
      .from('grade_ranges')
      .select('letter, min_percentage, max_percentage')
      .eq('grade_template_id', (cga as { grade_template_id: string }).grade_template_id)
      .order('sort_order', { ascending: true });
    throwIfDbError(rErr);
    return (ranges || []) as GradeRangeRow[];
  }

  private letterFromRanges(ranges: GradeRangeRow[] | null, percentage: number): string | undefined {
    if (!ranges?.length) return undefined;
    const p = Number(percentage);
    const range = ranges.find(
      (r) => p >= Number(r.min_percentage) && p <= Number(r.max_percentage),
    );
    return range?.letter;
  }

  /**
   * Get assessments for class section and academic year.
   * V1: no config - all result types include all assessments.
   */
  private async getAssessmentsInScope(
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    _resultType: ResultType,
  ): Promise<Map<string, { subjectId: string; totalMarks: number; subjectName?: string; title?: string }>> {
    const supabase = this.supabaseConfig.getClient();
    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('id, subject_id, total_marks, title')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    throwIfDbError(error);
    const list = (assessments || []) as { id: string; subject_id: string; total_marks: number; title?: string }[];
    const subjectIds = [...new Set(list.map((a) => a.subject_id))];
    let subjectNames = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabase
        .from('subjects')
        .select('id, name')
        .in('id', subjectIds);
      subjectNames = new Map(
        (subjects || []).map((s: { id: string; name: string }) => [s.id, s.name]),
      );
    }
    const map = new Map<
      string,
      { subjectId: string; totalMarks: number; subjectName?: string; title?: string }
    >();
    for (const a of list) {
      map.set(a.id, {
        subjectId: a.subject_id,
        totalMarks: Number(a.total_marks) || 0,
        subjectName: subjectNames.get(a.subject_id),
        title: a.title ?? undefined,
      });
    }
    return map;
  }

  async getResultForStudent(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
    resultType: ResultType = 'final',
  ): Promise<StudentResultDto> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const { data: cs, error: csErr } = await supabase
      .from('class_sections')
      .select('id, class_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .maybeSingle();
    throwIfDbError(csErr);
    if (!cs) throw new NotFoundException('Class section not found');
    const classId = (cs as { class_id: string }).class_id;

    const { data: student, error: stErr } = await supabase
      .from('students')
      .select('id, user_id, student_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('class_id', classId)
      .maybeSingle();
    throwIfDbError(stErr);
    if (!student) throw new NotFoundException('Student not found in this class section');
    const studentRow = student as { id: string; user_id: string | null; student_id: string | null };

    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
    );
    const assessmentIds = [...assessmentMap.keys()];
    if (assessmentIds.length === 0) {
      const letterRanges = await this.getLetterGradeRanges(classId);
      return new StudentResultDto({
        studentId: studentRow.id,
        studentName: '',
        studentStudentId: studentRow.student_id ?? undefined,
        subjects: [],
        overallPercentage: 0,
        overallLetterGrade: this.letterFromRanges(letterRanges, 0),
      });
    }

    const { data: gradeRows, error: gErr } = await supabase
      .from('student_grades')
      .select('assessment_id, marks_obtained')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .in('assessment_id', assessmentIds);
    throwIfDbError(gErr);
    const byAssessment = new Map<string, number>();
    for (const g of gradeRows || []) {
      const row = g as { assessment_id: string; marks_obtained: number };
      const prev = byAssessment.get(row.assessment_id) ?? 0;
      byAssessment.set(row.assessment_id, prev + (Number(row.marks_obtained) || 0));
    }

    const bySubject = new Map<
      string,
      { marksObtained: number; totalMarks: number; subjectName: string }
    >();
    for (const [assessId, assessInfo] of assessmentMap) {
      const marks = byAssessment.get(assessId) ?? 0;
      const total = assessInfo.totalMarks || 1;
      const existing = bySubject.get(assessInfo.subjectId);
      if (existing) {
        existing.marksObtained += marks;
        existing.totalMarks += total;
      } else {
        bySubject.set(assessInfo.subjectId, {
          marksObtained: marks,
          totalMarks: total,
          subjectName: assessInfo.subjectName ?? 'Unknown',
        });
      }
    }

    const letterRanges = await this.getLetterGradeRanges(classId);
    const subjects: ResultSubjectDto[] = [];
    let totalPct = 0;
    let subjectCount = 0;
    for (const [subjectId, data] of bySubject) {
      const totalMarks = data.totalMarks || 1;
      const percentage = Math.round((data.marksObtained / totalMarks) * 100);
      const letterGrade = this.letterFromRanges(letterRanges, percentage);
      subjects.push(
        new ResultSubjectDto({
          subjectId,
          subjectName: data.subjectName,
          marksObtained: data.marksObtained,
          totalMarks: data.totalMarks,
          percentage,
          letterGrade,
        }),
      );
      totalPct += percentage;
      subjectCount += 1;
    }
    subjects.sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
    const overallPercentage =
      subjectCount > 0 ? Math.round(totalPct / subjectCount) : 0;
    const overallLetterGrade = this.letterFromRanges(letterRanges, overallPercentage);

    let studentName = '';
    if (studentRow.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', studentRow.user_id)
        .maybeSingle();
      studentName = (profile as { full_name?: string } | null)?.full_name ?? '';
    }

    return new StudentResultDto({
      studentId: studentRow.id,
      studentName,
      studentStudentId: studentRow.student_id ?? undefined,
      subjects,
      overallPercentage,
      overallLetterGrade,
    });
  }

  /** Build assessment-wise entries for a student (same scope as getResultForStudent). */
  private async buildAssessmentWiseEntries(
    studentId: string,
    classSectionId: string,
    branchId: string,
    yearId: string,
    resultType: ResultType,
  ): Promise<AssessmentWiseEntryDto[]> {
    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
    );
    const assessmentIds = [...assessmentMap.keys()];
    if (assessmentIds.length === 0) return [];
    const supabase = this.supabaseConfig.getClient();
    const { data: gradeRows } = await supabase
      .from('student_grades')
      .select('assessment_id, marks_obtained')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .in('assessment_id', assessmentIds);
    const entries: AssessmentWiseEntryDto[] = [];
    for (const g of gradeRows || []) {
      const row = g as { assessment_id: string; marks_obtained: number };
      const info = assessmentMap.get(row.assessment_id);
      if (!info) continue;
      const total = info.totalMarks || 1;
      const marks = Number(row.marks_obtained) || 0;
      const percentage = Math.round((marks / total) * 100);
      entries.push(
        new AssessmentWiseEntryDto({
          assessmentId: row.assessment_id,
          assessmentTitle: info.title ?? 'Assessment',
          subjectName: info.subjectName ?? 'Unknown',
          marksObtained: marks,
          totalMarks: total,
          percentage,
        }),
      );
    }
    entries.sort((a, b) =>
      (a.subjectName || '').localeCompare(b.subjectName || '') ||
      (a.assessmentTitle || '').localeCompare(b.assessmentTitle || ''),
    );
    return entries;
  }

  /** 1-based class rank by overall percentage (same scope as getResultsForClassSection). */
  private async getClassRank(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    resultType: ResultType,
  ): Promise<number | undefined> {
    const batch = await this.getResultsForClassSection(
      classSectionId,
      branchId,
      academicYearId,
      resultType,
    );
    const sorted = [...batch.students].sort(
      (a, b) => (b.overallPercentage ?? 0) - (a.overallPercentage ?? 0),
    );
    const idx = sorted.findIndex((s) => s.studentId === studentId);
    return idx >= 0 ? idx + 1 : undefined;
  }

  /** 1-based school (branch) rank by overall percentage. */
  private async getSchoolRank(
    studentId: string,
    branchId: string,
    academicYearId: string,
    resultType: ResultType,
  ): Promise<number | undefined> {
    const supabase = this.supabaseConfig.getClient();
    const { data } = await supabase.rpc('get_school_rank_for_result', {
      _student_id: studentId,
      _branch_id: branchId,
      _academic_year_id: academicYearId,
      _result_type: resultType,
    });
    if (data == null) return undefined;
    const rank = Number(data);
    return Number.isNaN(rank) || rank <= 0 ? undefined : rank;
  }

  /** Generate short paragraph: "Needs improvement" if in last 2 grades from fail, else motivating. */
  private async getGeneratedParagraph(
    classId: string,
    overallPercentage: number,
  ): Promise<string> {
    const ranges = await this.getLetterGradeRanges(classId);
    if (!ranges?.length) {
      return 'Keep up the effort and focus on consistent progress.';
    }
    const sorted = [...ranges].sort(
      (a, b) => Number(a.min_percentage) - Number(b.min_percentage),
    );
    const pct = Number(overallPercentage);
    const failThreshold = 3; // fail range + 2 ranges above
    const needsImprovementRanges = sorted.slice(0, Math.min(failThreshold, sorted.length));
    const inNeedsImprovement = needsImprovementRanges.some(
      (r) => pct >= Number(r.min_percentage) && pct <= Number(r.max_percentage),
    );
    if (inNeedsImprovement) {
      return 'Needs improvement. Please focus on weaker areas and seek support from your teachers.';
    }
    return 'Good progress. Keep up the effort and continue to work consistently.';
  }

  async getDetailedResultForStudent(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
    classTeacherComment?: string,
  ): Promise<DetailedStudentResultDto> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const { data, error } = await supabase.rpc('get_detailed_result', {
      _student_id: studentId,
      _class_section_id: classSectionId,
      _branch_id: branchId,
      _academic_year_id: yearId,
    });
    throwIfDbError(error as PostgrestError | null);
    if (!data) {
      throw new NotFoundException('Detailed result not found');
    }

    const payload = data as {
      studentId: string;
      studentName: string;
      studentStudentId?: string;
      subjects: {
        subjectId: string;
        subjectName: string;
        marksObtained: number;
        totalMarks: number;
        percentage: number;
        letterGrade?: string;
      }[];
      overallPercentage: number;
      overallLetterGrade?: string;
      assessmentWiseEntries: {
        assessmentId: string;
        assessmentTitle: string;
        subjectName: string;
        marksObtained: number;
        totalMarks: number;
        percentage: number;
      }[];
    };

    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    const classId = (cs as { class_id: string } | null)?.class_id;

    const [classRank, schoolRank, generatedParagraph] = await Promise.all([
      this.getClassRank(studentId, classSectionId, branchId, yearId, resultType),
      this.getSchoolRank(studentId, branchId, yearId, resultType),
      classId
        ? this.getGeneratedParagraph(classId, payload.overallPercentage ?? 0)
        : Promise.resolve('Keep up the effort and focus on consistent progress.'),
    ]);

    return new DetailedStudentResultDto({
      studentId: payload.studentId,
      studentName: payload.studentName,
      studentStudentId: payload.studentStudentId,
      subjects: payload.subjects.map(
        (s) =>
          new ResultSubjectDto({
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            marksObtained: s.marksObtained,
            totalMarks: s.totalMarks,
            percentage: s.percentage,
            letterGrade: s.letterGrade,
          }),
      ),
      overallPercentage: payload.overallPercentage,
      overallLetterGrade: payload.overallLetterGrade,
      assessmentWiseEntries: payload.assessmentWiseEntries.map(
        (e) =>
          new AssessmentWiseEntryDto({
            assessmentId: e.assessmentId,
            assessmentTitle: e.assessmentTitle,
            subjectName: e.subjectName,
            marksObtained: e.marksObtained,
            totalMarks: e.totalMarks,
            percentage: e.percentage,
          }),
      ),
      classRank,
      schoolRank,
      generatedParagraph,
      classTeacherComment,
    });
  }

  async getResultsForClassSection(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
    resultType: ResultType = 'final',
  ): Promise<ClassSectionResultsDto> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const { data: cs, error: csErr } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .maybeSingle();
    throwIfDbError(csErr);
    if (!cs) throw new NotFoundException('Class section not found');
    const c = cs as { class_id: string; section_id: string };

    const [classRes, sectionRes, studentRows] = await Promise.all([
      supabase.from('classes').select('display_name').eq('id', c.class_id).single(),
      supabase.from('sections').select('name').eq('id', c.section_id).single(),
      supabase
        .from('students')
        .select('id, user_id, student_id')
        .eq('class_id', c.class_id)
        .eq('section_id', c.section_id)
        .eq('branch_id', branchId)
        .eq('academic_year_id', yearId)
        .eq('is_active', true),
    ]);
    const className = (classRes.data as { display_name?: string } | null)?.display_name ?? '';
    const sectionName = (sectionRes.data as { name?: string } | null)?.name ?? '';
    const students = (studentRows.data || []) as {
      id: string;
      user_id: string | null;
      student_id: string | null;
    }[];

    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
    );
    const assessmentIds = [...assessmentMap.keys()];
    const studentIds = students.map((s) => s.id);

    let gradeRows: { student_id: string; assessment_id: string; marks_obtained: number }[] = [];
    if (studentIds.length > 0 && assessmentIds.length > 0) {
      const { data: grades, error: gErr } = await supabase
        .from('student_grades')
        .select('student_id, assessment_id, marks_obtained')
        .in('student_id', studentIds)
        .in('assessment_id', assessmentIds)
        .eq('branch_id', branchId)
        .eq('academic_year_id', yearId);
      throwIfDbError(gErr);
      gradeRows = (grades || []) as {
        student_id: string;
        assessment_id: string;
        marks_obtained: number;
      }[];
    }

    const byStudent = new Map<
      string,
      Map<string, { marksObtained: number; totalMarks: number; subjectName: string }>
    >();
    for (const s of students) {
      byStudent.set(s.id, new Map());
    }
    for (const g of gradeRows) {
      const info = assessmentMap.get(g.assessment_id);
      if (!info) continue;
      let sub = byStudent.get(g.student_id);
      if (!sub) {
        sub = new Map();
        byStudent.set(g.student_id, sub);
      }
      const existing = sub.get(info.subjectId);
      const total = info.totalMarks || 1;
      if (existing) {
        existing.marksObtained += Number(g.marks_obtained) || 0;
        existing.totalMarks += total;
      } else {
        sub.set(info.subjectId, {
          marksObtained: Number(g.marks_obtained) || 0,
          totalMarks: total,
          subjectName: info.subjectName ?? 'Unknown',
        });
      }
    }

    const userIds = [...new Set(students.map((s) => s.user_id).filter(Boolean))] as string[];
    let profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      profileMap = new Map(
        (profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
      );
    }

    const letterRanges = await this.getLetterGradeRanges(c.class_id);
    const studentDtos: StudentResultDto[] = [];
    for (const s of students) {
      const subMap = byStudent.get(s.id) ?? new Map();
      const subjects: ResultSubjectDto[] = [];
      let totalPct = 0;
      let subjectCount = 0;
      for (const [subjectId, data] of subMap) {
        const totalMarks = data.totalMarks || 1;
        const percentage = Math.round((data.marksObtained / totalMarks) * 100);
        const letterGrade = this.letterFromRanges(letterRanges, percentage);
        subjects.push(
          new ResultSubjectDto({
            subjectId,
            subjectName: data.subjectName,
            marksObtained: data.marksObtained,
            totalMarks: data.totalMarks,
            percentage,
            letterGrade,
          }),
        );
        totalPct += percentage;
        subjectCount += 1;
      }
      subjects.sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || ''));
      const overallPercentage = subjectCount > 0 ? Math.round(totalPct / subjectCount) : 0;
      const overallLetterGrade = this.letterFromRanges(letterRanges, overallPercentage);
      studentDtos.push(
        new StudentResultDto({
          studentId: s.id,
          studentName: profileMap.get(s.user_id || '') ?? '',
          studentStudentId: s.student_id ?? undefined,
          subjects,
          overallPercentage,
          overallLetterGrade,
        }),
      );
    }

    return new ClassSectionResultsDto({
      classSectionId,
      className,
      sectionName,
      academicYearId: yearId,
      resultType,
      students: studentDtos,
    });
  }

  async generateResultCard(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
    generatedBy: string,
  ): Promise<ResultCardDto> {
    const result = await this.getResultForStudent(
      studentId,
      classSectionId,
      branchId,
      academicYearId,
      resultType,
    );
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const resultData = {
      studentId: result.studentId,
      studentName: result.studentName,
      studentStudentId: result.studentStudentId,
      subjects: result.subjects,
      overallPercentage: result.overallPercentage,
      overallLetterGrade: result.overallLetterGrade,
    };

    const supabase = this.supabaseConfig.getClient();
    const row = {
      student_id: studentId,
      class_section_id: classSectionId,
      academic_year_id: yearId,
      branch_id: branchId,
      result_type: resultType,
      generated_by: generatedBy,
      result_data: resultData,
      status: 'draft',
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('result_cards')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_section_id', classSectionId)
      .eq('academic_year_id', yearId)
      .eq('result_type', resultType)
      .maybeSingle();

    let out: { id: string; created_at: string; updated_at: string; [k: string]: unknown };
    if (existing) {
      const { data: updated, error } = await supabase
        .from('result_cards')
        .update({
          result_data: row.result_data,
          generated_at: new Date().toISOString(),
          generated_by: row.generated_by,
          updated_at: row.updated_at,
        })
        .eq('id', (existing as { id: string }).id)
        .select()
        .single();
      throwIfDbError(error);
      out = updated as { id: string; created_at: string; updated_at: string; [k: string]: unknown };
    } else {
      const { data: inserted, error } = await supabase
        .from('result_cards')
        .insert({
          student_id: row.student_id,
          class_section_id: row.class_section_id,
          academic_year_id: row.academic_year_id,
          branch_id: row.branch_id,
          result_type: row.result_type,
          generated_by: row.generated_by,
          result_data: row.result_data,
          status: row.status,
        })
        .select()
        .single();
      throwIfDbError(error);
      out = inserted as { id: string; created_at: string; updated_at: string; [k: string]: unknown };
    }

    return this.mapResultCardRow(out);
  }

  async updateResultCardStatus(
    id: string,
    status: string,
    branchId: string,
    approvedBy?: string,
  ): Promise<ResultCardDto> {
    const supabase = this.supabaseConfig.getClient();
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'approved' || status === 'published') {
      update.approved_by = approvedBy ?? null;
      update.approved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('result_cards')
      .update(update)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Result card not found');
    return this.mapResultCardRow(data as Record<string, unknown>);
  }

  async listResultCardsByStudent(
    studentId: string,
    branchId: string,
    academicYearId?: string,
    resultType?: string,
    publishedOnly = false,
  ): Promise<ResultCardDto[]> {
    const supabase = this.supabaseConfig.getClient();
    let query = supabase
      .from('result_cards')
      .select('*')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .order('generated_at', { ascending: false });
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    if (resultType) query = query.eq('result_type', resultType);
    if (publishedOnly) query = query.eq('status', 'published');
    const { data, error } = await query;
    throwIfDbError(error);
    return ((data || []) as Record<string, unknown>[]).map((row) => this.mapResultCardRow(row));
  }

  /** List all result cards for a class section (for admin/teacher publish UI). */
  async listResultCardsByClassSection(
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    resultType: string,
  ): Promise<ResultCardDto[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('result_cards')
      .select('*')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('result_type', resultType)
      .order('student_id')
      .order('generated_at', { ascending: false });
    throwIfDbError(error);
    return ((data || []) as Record<string, unknown>[]).map((row) => this.mapResultCardRow(row));
  }

  async getResultCardById(id: string, branchId: string): Promise<ResultCardDto | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('result_cards')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) return null;
    return this.mapResultCardRow(data as Record<string, unknown>);
  }

  private mapResultCardRow(row: Record<string, unknown>): ResultCardDto {
    return new ResultCardDto({
      id: row.id as string,
      studentId: row.student_id as string,
      classSectionId: row.class_section_id as string,
      academicYearId: row.academic_year_id as string,
      branchId: row.branch_id as string,
      resultType: row.result_type as string,
      generatedAt: row.generated_at as string | undefined,
      generatedBy: row.generated_by as string | undefined,
      resultData: (row.result_data as Record<string, unknown>) || {},
      pdfUrl: row.pdf_url as string | undefined,
      status: row.status as string,
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at as string | undefined,
      classTeacherComment: row.class_teacher_comment as string | undefined,
      createdAt: row.created_at as string | undefined,
      updatedAt: row.updated_at as string | undefined,
    });
  }

  async updateResultCardComment(
    id: string,
    classTeacherComment: string | undefined,
    branchId: string,
  ): Promise<ResultCardDto> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('result_cards')
      .update({
        class_teacher_comment: classTeacherComment ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select()
      .single();
    throwIfDbError(error);
    if (!data) throw new NotFoundException('Result card not found');
    return this.mapResultCardRow(data as Record<string, unknown>);
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  /** Get class teacher comment from result card if it exists. */
  private async getResultCardComment(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    resultType: string,
  ): Promise<string | undefined> {
    const cards = await this.listResultCardsByStudent(
      studentId,
      branchId,
      academicYearId,
      resultType,
      false,
    );
    const card = cards.find(
      (c) =>
        c.classSectionId === classSectionId &&
        c.academicYearId === academicYearId &&
        c.resultType === resultType,
    );
    return card?.classTeacherComment;
  }

  async generateResultCardPdf(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
    options?: { reportType?: 'basic' | 'detailed' },
  ): Promise<Buffer> {
    const reportType = options?.reportType ?? 'basic';
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    if (reportType === 'detailed') {
      const comment = await this.getResultCardComment(
        studentId,
        classSectionId,
        branchId,
        yearId,
        resultType,
      );
      if (resultType === 'final') {
        const midComment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          'mid_term',
        );
        const finalComment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          'final',
        );
        const [midDetail, finalDetail] = await Promise.all([
          this.getDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            'mid_term',
            midComment,
          ),
          this.getDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            'final',
            finalComment,
          ),
        ]);
        return this.renderDetailedPdfTwoPages(midDetail, finalDetail, classSectionId, branchId);
      }
      const detailed = await this.getDetailedResultForStudent(
        studentId,
        classSectionId,
        branchId,
        academicYearId,
        resultType,
        comment,
      );
      const resultTypeLabel =
        resultType === 'interim'
          ? 'Interim Result'
          : resultType === 'mid_term'
            ? 'Mid-term Result'
            : 'Final Result';
      return this.renderDetailedPdfSingle(
        detailed,
        resultTypeLabel,
        classSectionId,
        branchId,
      );
    }

    const [result, classRank] = await Promise.all([
      this.getResultForStudent(
        studentId,
        classSectionId,
        branchId,
        academicYearId,
        resultType,
      ),
      this.getClassRank(studentId, classSectionId, branchId, yearId, resultType),
    ]);
    const supabase = this.supabaseConfig.getClient();
    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    const { data: classRow } = cs
      ? await supabase.from('classes').select('display_name').eq('id', (cs as { class_id: string }).class_id).single()
      : { data: null };
    const { data: sectionRow } = cs
      ? await supabase.from('sections').select('name').eq('id', (cs as { section_id: string }).section_id).single()
      : { data: null };
    const className = (classRow as { display_name?: string } | null)?.display_name ?? '';
    const sectionName = (sectionRow as { name?: string } | null)?.name ?? '';
    const resultTypeLabel =
      resultType === 'interim' ? 'Interim Result' : resultType === 'mid_term' ? 'Mid-term Result' : 'Final Result';

    let rows = '';
    for (const s of result.subjects) {
      rows += `<tr><td>${this.escapeHtml(s.subjectName)}</td><td>${s.marksObtained}</td><td>${s.totalMarks}</td><td>${s.percentage}%</td><td>${this.escapeHtml(s.letterGrade ?? '—')}</td></tr>`;
    }
    if (result.subjects.length === 0) {
      rows = '<tr><td colspan="5">No grades recorded</td></tr>';
    }
    const overallRow =
      result.overallPercentage != null
        ? `<tr><td colspan="3"><strong>Overall</strong></td><td><strong>${result.overallPercentage}%</strong></td><td><strong>${this.escapeHtml(result.overallLetterGrade ?? '—')}</strong></td></tr>`
        : '';
    const classRankLine =
      classRank != null
        ? `<p class="sub">Class position: ${classRank}</p>`
        : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; padding: 20px; color: #212529; }
  .header { margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #868e96; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #dee2e6; padding: 10px; text-align: left; }
  th { background: #f8f9fa; font-weight: 600; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(resultTypeLabel)}</h1>
    <p class="sub">${this.escapeHtml(result.studentName)}</p>
    <p class="sub">${this.escapeHtml(className)} - ${this.escapeHtml(sectionName)}</p>
    ${classRankLine}
  </div>
  <table>
    <thead><tr><th>Subject</th><th>Marks</th><th>Total</th><th>%</th><th>Grade</th></tr></thead>
    <tbody>${rows}${overallRow}</tbody>
  </table>
</body>
</html>`;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(0);
      await page.setContent(htmlContent, { waitUntil: 'load', timeout: 0 });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async getClassSectionLabels(
    classSectionId: string,
    branchId: string,
  ): Promise<{ className: string; sectionName: string }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!cs) return { className: '', sectionName: '' };
    const c = cs as { class_id: string; section_id: string };
    const [classRow, sectionRow] = await Promise.all([
      supabase.from('classes').select('display_name').eq('id', c.class_id).single(),
      supabase.from('sections').select('name').eq('id', c.section_id).single(),
    ]);
    return {
      className: (classRow.data as { display_name?: string } | null)?.display_name ?? '',
      sectionName: (sectionRow.data as { name?: string } | null)?.name ?? '',
    };
  }

  private renderDetailedPdfSingle(
    d: DetailedStudentResultDto,
    resultTypeLabel: string,
    classSectionId: string,
    branchId: string,
  ): Promise<Buffer> {
    return this.buildDetailedPdf(d, resultTypeLabel, classSectionId, branchId);
  }

  private async renderDetailedPdfTwoPages(
    midDetail: DetailedStudentResultDto,
    finalDetail: DetailedStudentResultDto,
    classSectionId: string,
    branchId: string,
  ): Promise<Buffer> {
    const htmlPage1 = await this.buildDetailedHtmlInner(
      midDetail,
      'Final Report — Mid-term Session',
      classSectionId,
      branchId,
    );
    const htmlPage2 = await this.buildDetailedHtmlInner(
      finalDetail,
      'Final Report — Full Year',
      classSectionId,
      branchId,
    );
    const fullHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; padding: 20px; color: #212529; }
  .header { margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #868e96; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #dee2e6; padding: 10px; text-align: left; }
  th { background: #f8f9fa; font-weight: 600; }
  .page-break { page-break-before: always; }
  .rank-star { color: #f59e0b; }
</style>
</head>
<body>
  ${htmlPage1}
  <div class="page-break"></div>
  ${htmlPage2}
</body>
</html>`;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async buildDetailedHtmlInner(
    d: DetailedStudentResultDto,
    resultTypeLabel: string,
    classSectionId: string,
    branchId: string,
  ): Promise<string> {
    const labels = await this.getClassSectionLabels(classSectionId, branchId);
    const classRankStr =
      d.classRank != null
        ? `Class position: ${d.classRank}${d.classRank === 1 ? ' <span class="rank-star">★</span>' : ''}`
        : '—';
    const schoolRankStr =
      d.schoolRank != null
        ? `School position: ${d.schoolRank}${d.schoolRank === 1 ? ' <span class="rank-star">★</span>' : ''}`
        : '—';
    let subjectRows = '';
    for (const s of d.subjects) {
      subjectRows += `<tr><td>${this.escapeHtml(s.subjectName)}</td><td>${s.marksObtained}</td><td>${s.totalMarks}</td><td>${s.percentage}%</td><td>${this.escapeHtml(s.letterGrade ?? '—')}</td></tr>`;
    }
    if (d.subjects.length === 0) {
      subjectRows = '<tr><td colspan="5">No grades recorded</td></tr>';
    }
    const overallRow =
      d.overallPercentage != null
        ? `<tr><td colspan="3"><strong>Overall</strong></td><td><strong>${d.overallPercentage}%</strong></td><td><strong>${this.escapeHtml(d.overallLetterGrade ?? '—')}</strong></td></tr>`
        : '';
    let assessmentRows = '';
    for (const e of d.assessmentWiseEntries) {
      assessmentRows += `<tr><td>${this.escapeHtml(e.assessmentTitle)}</td><td>${this.escapeHtml(e.subjectName)}</td><td>${e.marksObtained}</td><td>${e.totalMarks}</td><td>${e.percentage}%</td></tr>`;
    }
    if (d.assessmentWiseEntries.length === 0) {
      assessmentRows = '<tr><td colspan="5">No assessment-wise data</td></tr>';
    }
    const commentBlock = d.classTeacherComment
      ? `<div class="section" style="margin-top: 16px;"><div class="section-title">Class teacher comment</div><p>${this.escapeHtml(d.classTeacherComment)}</p></div>`
      : '';

    const inner = `
  <div class="header">
    <h1>${this.escapeHtml(resultTypeLabel)}</h1>
    <p class="sub">${this.escapeHtml(d.studentName)}</p>
    <p class="sub">${labels.className} - ${labels.sectionName}</p>
    <p class="sub">${classRankStr} &nbsp;|&nbsp; ${schoolRankStr}</p>
  </div>
  <table>
    <thead><tr><th>Subject</th><th>Marks</th><th>Total</th><th>%</th><th>Grade</th></tr></thead>
    <tbody>${subjectRows}${overallRow}</tbody>
  </table>
  <div class="section" style="margin-top: 20px;">
    <div class="section-title">Assessment-wise breakdown</div>
    <table>
      <thead><tr><th>Assessment</th><th>Subject</th><th>Marks</th><th>Total</th><th>%</th></tr></thead>
      <tbody>${assessmentRows}</tbody>
    </table>
  </div>
  <div class="section" style="margin-top: 16px;">
    <div class="section-title">Remarks</div>
    <p>${this.escapeHtml(d.generatedParagraph)}</p>
  </div>
  ${commentBlock}`;
    return inner;
  }

  private async buildDetailedPdf(
    d: DetailedStudentResultDto,
    resultTypeLabel: string,
    classSectionId: string,
    branchId: string,
  ): Promise<Buffer> {
    const inner = await this.buildDetailedHtmlInner(
      d,
      resultTypeLabel,
      classSectionId,
      branchId,
    );
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; padding: 20px; color: #212529; }
  .header { margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #868e96; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #dee2e6; padding: 10px; text-align: left; }
  th { background: #f8f9fa; font-weight: 600; }
  .section-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .rank-star { color: #f59e0b; }
</style>
</head>
<body>${inner}
</body>
</html>`;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * Build behavioral section from raw assessments (same structure as ReportsService).
   */
  private buildBehavioralPeriods(
    assessments: { assessmentMonth: string; scores: { attributeName: string; score: number }[] }[],
  ): BehavioralPeriod[] {
    const byPeriod = new Map<string, Map<string, number[]>>();
    for (const a of assessments) {
      const period = a.assessmentMonth.slice(0, 7);
      let attrMap = byPeriod.get(period);
      if (!attrMap) {
        attrMap = new Map();
        byPeriod.set(period, attrMap);
      }
      for (const s of a.scores) {
        const list = attrMap.get(s.attributeName) || [];
        list.push(s.score);
        attrMap.set(s.attributeName, list);
      }
    }
    const periods: BehavioralPeriod[] = [];
    for (const [period, attrMap] of byPeriod.entries()) {
      const attributes: { attributeName: string; average: number }[] = [];
      for (const [name, values] of attrMap.entries()) {
        const avg = values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
        attributes.push({ attributeName: name, average: avg });
      }
      periods.push({ period, attributes });
    }
    periods.sort((a, b) => b.period.localeCompare(a.period));
    return periods;
  }

  /**
   * Generate behavioural report PDF (star-based UI). Throws if no behavioural data.
   */
  async generateBehavioralReportPdf(
    studentId: string,
    branchId: string,
    academicYearId: string | undefined,
  ): Promise<Buffer> {
    const { data: assessments } = await this.behavioralService.getByStudent(
      studentId,
      branchId,
      academicYearId,
    );
    if (!assessments?.length) {
      throw new BadRequestException(
        'Behavioural metrics not set for this student. Please contact the administrator.',
      );
    }
    const periods = this.buildBehavioralPeriods(
      assessments.map((a) => ({
        assessmentMonth: a.assessmentMonth,
        scores: a.scores.map((s) => ({ attributeName: s.attributeName, score: s.score })),
      })),
    );
    const allAttributes = Array.from(
      new Set(periods.flatMap((p) => p.attributes.map((a) => a.attributeName))),
    ).sort();
    const renderStars = (value: number): string => {
      const fullStars = Math.floor(value);
      const hasHalfStar = value % 1 >= 0.5;
      let stars = '★'.repeat(fullStars);
      if (hasHalfStar) stars += '☆';
      return stars || '—';
    };
    let tableRows = '';
    for (const p of periods) {
      const attrMap = Object.fromEntries(p.attributes.map((a) => [a.attributeName, a.average]));
      tableRows += `<tr><td>${this.escapeHtml(p.period)}</td>`;
      for (const attr of allAttributes) {
        const value = attrMap[attr];
        tableRows += `<td>${value != null ? `<span class="stars">${renderStars(value)} ${value.toFixed(1)}</span>` : '—'}</td>`;
      }
      tableRows += '</tr>\n';
    }
    let overallSum = 0;
    let overallCount = 0;
    for (const p of periods) {
      for (const a of p.attributes) {
        overallSum += a.average;
        overallCount += 1;
      }
    }
    const overallAverage = overallCount > 0 ? Math.round((overallSum / overallCount) * 10) / 10 : 0;
    const studentName = await this.getStudentName(studentId);
    const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; padding: 20px; color: #212529; }
  .header { margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
  .header .sub { font-size: 13px; color: #868e96; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #dee2e6; margin-top: 16px; }
  th, td { border: 1px solid #dee2e6; padding: 10px; text-align: left; }
  th { background: #f8f9fa; font-weight: 600; }
  .stars { font-size: 16px; color: #f59e0b; letter-spacing: 2px; }
  .overall { margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 4px; font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>Behavioural Report</h1>
    <p class="sub">${this.escapeHtml(studentName)}</p>
  </div>
  <table>
    <thead><tr><th>Period</th>${allAttributes.map((a) => `<th>${this.escapeHtml(a)}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="overall">Overall (star-based): <span class="stars">${renderStars(overallAverage)} ${overallAverage.toFixed(1)}</span></div>
</body>
</html>`;
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async getStudentName(studentId: string): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    const { data: student } = await supabase
      .from('students')
      .select('user_id')
      .eq('id', studentId)
      .maybeSingle();
    if (!student?.user_id) return 'Student';
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', (student as { user_id: string }).user_id)
      .maybeSingle();
    return (profile as { full_name?: string } | null)?.full_name ?? 'Student';
  }

  private async getAcademicYearCode(
    academicYearId: string | undefined,
    branchId: string,
  ): Promise<string> {
    const supabase = this.supabaseConfig.getClient();
    let yearId = academicYearId;
    if (!yearId) {
      const active = await this.academicYearsService.getActiveForBranch(branchId);
      if (!active) return 'Year';
      yearId = active.id;
    }
    const { data } = await supabase
      .from('academic_years')
      .select('name')
      .eq('id', yearId)
      .maybeSingle();
    const name = (data as { name?: string } | null)?.name ?? '';
    const match = name.match(/\d{4}$/);
    if (match) return match[0];
    if (name) return name.replace(/[^A-Za-z0-9]/g, '');
    return 'Year';
  }

  async buildResultCardFilename(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    reportType: 'basic' | 'detailed',
  ): Promise<string> {
    const [studentName, labels, yearCode] = await Promise.all([
      this.getStudentName(studentId),
      this.getClassSectionLabels(classSectionId, branchId),
      this.getAcademicYearCode(academicYearId, branchId),
    ]);
    const clean = (value: string): string =>
      value.replace(/\s+/g, '').replace(/[^A-Za-z0-9]/g, '');
    const studentSeg = clean(studentName) || 'Student';
    const classSeg = clean(`${labels.className ?? ''}${labels.sectionName ?? ''}`) || 'Class';
    const typeCode = reportType === 'detailed' ? 'DR' : 'BR';
    const yearSeg = clean(yearCode) || 'Year';
    return `ReportCard-${studentSeg}-${classSeg}-${typeCode}-${yearSeg}.pdf`;
  }

  private static readonly BULK_MAX_STUDENTS = 60;
  private static readonly BULK_PDF_CHUNK = 3;

  /**
   * Returns a zip stream of result card PDFs for all students in the class section.
   * Caller must pipe the stream to response and set headers. Max 60 students.
   */
  async getBulkResultCardPdfStream(
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
  ): Promise<archiver.Archiver> {
    const batch = await this.getResultsForClassSection(
      classSectionId,
      branchId,
      academicYearId,
      resultType,
    );
    if (batch.students.length > ResultsService.BULK_MAX_STUDENTS) {
      throw new BadRequestException(
        `Maximum ${ResultsService.BULK_MAX_STUDENTS} students per bulk download. This section has ${batch.students.length}.`,
      );
    }
    const CHUNK = ResultsService.BULK_PDF_CHUNK;
    const pdfs: { name: string; buffer: Buffer }[] = [];
    for (let i = 0; i < batch.students.length; i += CHUNK) {
      const chunk = batch.students.slice(i, i + CHUNK);
      const buffers = await Promise.all(
        chunk.map((s) =>
          this.generateResultCardPdf(
            s.studentId,
            classSectionId,
            branchId,
            academicYearId,
            resultType,
          ),
        ),
      );
      chunk.forEach((s, j) => {
        const safeName = `${s.studentId}_${(s.studentName || 'student').replace(/[^a-zA-Z0-9-_]/g, '_')}_${resultType}.pdf`;
        pdfs.push({ name: safeName, buffer: buffers[j]! });
      });
    }
    const archive = archiver('zip', { zlib: { level: 9 } });
    for (const { name, buffer } of pdfs) {
      archive.append(buffer, { name });
    }
    archive.finalize();
    return archive;
  }
}
