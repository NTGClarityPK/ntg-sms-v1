import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { GradesService } from '../grades/grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { BehavioralService } from '../behavioral/behavioral.service';
import { StudentsService } from '../students/students.service';
import { StudentGradeDto } from '../grades/dto/student-grade.dto';
import {
  AcademicEntryDto,
  AcademicSectionDto,
} from './dto/academic-section.dto';
import { AttendanceSectionDto } from './dto/attendance-section.dto';
import {
  BehavioralSectionDto,
  BehavioralPeriodDto,
  BehavioralAttributeAverageDto,
} from './dto/behavioral-section.dto';
import { StudentReportDto } from './dto/student-report.dto';
import {
  ClassReportDto,
  ClassReportStudentDto,
} from './dto/class-report.dto';
import {
  RankingsDto,
  RankingEntryDto,
} from './dto/rankings.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type GradeRangeRow = {
  letter: string;
  min_percentage: number;
  max_percentage: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly gradesService: GradesService,
    private readonly attendanceService: AttendanceService,
    private readonly behavioralService: BehavioralService,
    private readonly studentsService: StudentsService,
  ) {}

  /**
   * Load letter grade ranges for a class (single query batch for buildAcademicSection).
   */
  private async getLetterGradeRanges(
    classId: string,
  ): Promise<GradeRangeRow[] | null> {
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
   * Get student's class_section_id for active year (for rank computation).
   */
  private async getStudentClassSectionId(
    studentId: string,
    branchId: string,
    academicYearId: string,
  ): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data: student, error } = await supabase
      .from('students')
      .select('class_id, section_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .maybeSingle();
    throwIfDbError(error);
    if (!student || !(student as { class_id: string }).class_id) return null;

    const s = student as { class_id: string; section_id: string };
    const { data: cs } = await supabase
      .from('class_sections')
      .select('id')
      .eq('class_id', s.class_id)
      .eq('section_id', s.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .maybeSingle();
    return (cs as { id: string } | null)?.id ?? null;
  }

  async getStudentReport(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: StudentReportDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;

    const student = await this.studentsService.getStudentById(studentId, branchId);

    const [grades, attendanceSummary, behavioralRes] = await Promise.all([
      this.gradesService.getGradesByStudent(studentId, branchId).catch(() => [] as StudentGradeDto[]),
      this.attendanceService.getAttendanceSummaryByStudent(studentId, branchId, yearId),
      this.behavioralService.getByStudent(studentId, branchId, yearId),
    ]);

    const academic = await this.buildAcademicSection(
      grades,
      student.classId ?? undefined,
      studentId,
      branchId,
      yearId,
    );
    const attendance = new AttendanceSectionDto({
      totalDays: attendanceSummary.totalDays,
      presentDays: attendanceSummary.presentDays,
      absentDays: attendanceSummary.absentDays,
      lateDays: attendanceSummary.lateDays,
      excusedDays: attendanceSummary.excusedDays,
      percentage: attendanceSummary.percentage,
    });
    const behavioral = this.buildBehavioralSection(behavioralRes.data);

    return {
      data: new StudentReportDto({
        studentId,
        studentName: student.fullName ?? 'Unknown',
        academicYearId: yearId,
        academicYearName: activeYear.name,
        academic,
        attendance,
        behavioral,
      }),
    };
  }

  async getStudentAcademicReport(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: AcademicSectionDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;

    const student = await this.studentsService.getStudentById(studentId, branchId);
    const grades = await this.gradesService.getGradesByStudent(studentId, branchId);
    const academic = await this.buildAcademicSection(
      grades,
      student?.classId,
      studentId,
      branchId,
      yearId,
    );
    return { data: academic };
  }

  async getStudentAttendanceReport(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: AttendanceSectionDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;

    await this.studentsService.getStudentById(studentId, branchId);

    const summary = await this.attendanceService.getAttendanceSummaryByStudent(
      studentId,
      branchId,
      yearId,
    );
    return {
      data: new AttendanceSectionDto({
        totalDays: summary.totalDays,
        presentDays: summary.presentDays,
        absentDays: summary.absentDays,
        lateDays: summary.lateDays,
        excusedDays: summary.excusedDays,
        percentage: summary.percentage,
      }),
    };
  }

  private async buildAcademicSection(
    grades: StudentGradeDto[],
    classId: string | undefined,
    studentId: string,
    branchId: string,
    academicYearId: string,
  ): Promise<AcademicSectionDto> {
    const supabase = this.supabaseConfig.getClient();
    if (grades.length === 0) {
      return new AcademicSectionDto({ entries: [] });
    }

    const assessmentIds = [...new Set(grades.map((g) => g.assessmentId))];
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, subject_id, title, total_marks')
      .in('id', assessmentIds);
    const assessmentMap = new Map(
      (assessments || []).map((a: { id: string; subject_id: string; title: string; total_marks: number }) => [
        a.id,
        { subjectId: a.subject_id, title: a.title, totalMarks: a.total_marks },
      ]),
    );

    const subjectIds = [...new Set([...assessmentMap.values()].map((a) => a.subjectId))];
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .in('id', subjectIds);
    const subjectMap = new Map(
      (subjects || []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );

    const classSectionId = await this.getStudentClassSectionId(
      studentId,
      branchId,
      academicYearId,
    );

    const [letterRanges, rankBySubject] = await Promise.all([
      classId ? this.getLetterGradeRanges(classId) : Promise.resolve(null),
      classSectionId && subjectIds.length > 0
        ? this.getRanksForStudentInSubjects(
            classSectionId,
            studentId,
            subjectIds,
            branchId,
            academicYearId,
          )
        : Promise.resolve(new Map<string, { rank?: number; percentile?: number }>()),
    ]);

    const entries: AcademicEntryDto[] = [];
    for (const g of grades) {
      const a = assessmentMap.get(g.assessmentId);
      if (!a) continue;
      const totalMarks = a.totalMarks || 1;
      const percentage =
        g.marksObtained != null ? Math.round((Number(g.marksObtained) / totalMarks) * 100) : 0;
      const letterGrade = this.letterFromRanges(letterRanges, percentage);
      const rankData = a.subjectId ? rankBySubject.get(a.subjectId) : undefined;

      entries.push(
        new AcademicEntryDto({
          assessmentId: g.assessmentId,
          subjectId: a.subjectId,
          subjectName: subjectMap.get(a.subjectId) ?? 'Unknown',
          assessmentTitle: a.title,
          marksObtained: Number(g.marksObtained),
          totalMarks,
          percentage,
          letterGrade,
          rank: rankData?.rank,
          percentile: rankData?.percentile,
        }),
      );
    }

    return new AcademicSectionDto({ entries });
  }

  /**
   * Batch load rank/percentile for one student across multiple subjects (avoids N+1).
   */
  private async getRanksForStudentInSubjects(
    classSectionId: string,
    studentId: string,
    subjectIds: string[],
    branchId: string,
    academicYearId: string,
  ): Promise<Map<string, { rank?: number; percentile?: number }>> {
    const supabase = this.supabaseConfig.getClient();
    const result = new Map<string, { rank?: number; percentile?: number }>();

    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!cs) return result;

    const c = cs as { class_id: string; section_id: string };
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    const studentIds = (students || []).map((s: { id: string }) => s.id);
    if (studentIds.length === 0) return result;

    const { data: assessList } = await supabase
      .from('assessments')
      .select('id, total_marks, subject_id')
      .eq('class_section_id', classSectionId)
      .in('subject_id', subjectIds)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    const assessments = (assessList || []) as { id: string; total_marks: number; subject_id: string }[];
    const assessmentIds = assessments.map((a) => a.id);
    if (assessmentIds.length === 0) return result;

    const { data: gradeRows } = await supabase
      .from('student_grades')
      .select('student_id, marks_obtained, assessment_id')
      .in('student_id', studentIds)
      .in('assessment_id', assessmentIds);
    const rows = (gradeRows || []) as { student_id: string; marks_obtained: number; assessment_id: string }[];

    const assessTotalMap = new Map(assessments.map((a) => [a.id, Number(a.total_marks) || 1]));
    const bySubject = new Map<string, Map<string, number[]>>();
    for (const r of rows) {
      const total = assessTotalMap.get(r.assessment_id) ?? 1;
      const pct = Math.round((Number(r.marks_obtained) / total) * 100);
      const subjectId = assessments.find((a) => a.id === r.assessment_id)?.subject_id;
      if (!subjectId) continue;
      let perStudent = bySubject.get(subjectId);
      if (!perStudent) {
        perStudent = new Map();
        bySubject.set(subjectId, perStudent);
      }
      const list = perStudent.get(r.student_id) || [];
      list.push(pct);
      perStudent.set(r.student_id, list);
    }

    for (const subjectId of subjectIds) {
      const perStudent = bySubject.get(subjectId);
      if (!perStudent) continue;
      const averages = new Map<string, number>();
      perStudent.forEach((pcts, sid) => {
        const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
        averages.set(sid, Math.round(avg));
      });
      const sorted = [...averages.entries()].sort((a, b) => b[1] - a[1]);
      const rankIndex = sorted.findIndex(([id]) => id === studentId);
      if (rankIndex < 0) continue;
      const rank = rankIndex + 1;
      const n = sorted.length;
      const percentile = n > 0 ? Math.round(((n - rank + 1) / n) * 100) : undefined;
      result.set(subjectId, {
        rank: rank <= 3 ? rank : undefined,
        percentile: rank > 3 ? percentile : undefined,
      });
    }
    return result;
  }

  private async getRankForStudentInSubject(
    classSectionId: string,
    subjectId: string,
    studentId: string,
    branchId: string,
    academicYearId: string,
    studentPercentage: number,
  ): Promise<{ rank?: number; percentile?: number }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!cs) return {};

    const c = cs as { class_id: string; section_id: string };
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    const studentIds = (students || []).map((s: { id: string }) => s.id);
    if (studentIds.length === 0) return {};

    const { data: assessList } = await supabase
      .from('assessments')
      .select('id, total_marks')
      .eq('class_section_id', classSectionId)
      .eq('subject_id', subjectId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    const assessmentIds = (assessList || []).map((a: { id: string }) => a.id);
    if (assessmentIds.length === 0) return {};

    const { data: gradeRows } = await supabase
      .from('student_grades')
      .select('student_id, marks_obtained, assessment_id')
      .in('student_id', studentIds)
      .in('assessment_id', assessmentIds);
    const assessTotalMap = new Map(
      (assessList || []).map((a: { id: string; total_marks: number }) => [a.id, Number(a.total_marks) || 1]),
    );

    const studentPercentages = new Map<string, number[]>();
    for (const row of gradeRows || []) {
      const r = row as { student_id: string; marks_obtained: number; assessment_id: string };
      const total = assessTotalMap.get(r.assessment_id) ?? 1;
      const pct = Math.round((Number(r.marks_obtained) / total) * 100);
      const list = studentPercentages.get(r.student_id) || [];
      list.push(pct);
      studentPercentages.set(r.student_id, list);
    }

    const averages = new Map<string, number>();
    studentPercentages.forEach((pcts, sid) => {
      const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      averages.set(sid, Math.round(avg));
    });

    const sorted = [...averages.entries()].sort((a, b) => b[1] - a[1]);
    const rankIndex = sorted.findIndex(([id]) => id === studentId);
    if (rankIndex < 0) return {};
    const rank = rankIndex + 1;
    const n = sorted.length;
    const percentile = n > 0 ? Math.round(((n - rank + 1) / n) * 100) : undefined;
    return {
      rank: rank <= 3 ? rank : undefined,
      percentile: rank > 3 ? percentile : undefined,
    };
  }

  private buildBehavioralSection(
    assessments: { assessmentMonth: string; scores: { attributeName: string; score: number }[] }[],
  ): BehavioralSectionDto {
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

    const periods: BehavioralPeriodDto[] = [];
    for (const [period, attrMap] of byPeriod.entries()) {
      const attributes: BehavioralAttributeAverageDto[] = [];
      for (const [name, values] of attrMap.entries()) {
        const sum = values.reduce((a, b) => a + b, 0);
        attributes.push(
          new BehavioralAttributeAverageDto({
            attributeName: name,
            average: values.length ? Math.round((sum / values.length) * 10) / 10 : 0,
            count: values.length,
          }),
        );
      }
      periods.push(new BehavioralPeriodDto({ period, attributes }));
    }
    periods.sort((a, b) => b.period.localeCompare(a.period));

    return new BehavioralSectionDto({ periods });
  }

  async getClassReport(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: ClassReportDto }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
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
    const [classRes, sectionRes] = await Promise.all([
      supabase.from('classes').select('display_name').eq('id', c.class_id).single(),
      supabase.from('sections').select('name').eq('id', c.section_id).single(),
    ]);
    const className = (classRes.data as { display_name?: string } | null)?.display_name ?? '';
    const sectionName = (sectionRes.data as { name?: string } | null)?.name ?? '';

    const { data: studentRows } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('is_active', true);
    const students = (studentRows || []) as { id: string; user_id: string | null }[];
    const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
    );

    const studentIds = students.map((s) => s.id);
    const summaryMap = await this.attendanceService.getAttendanceSummariesByStudents(
      studentIds,
      branchId,
      yearId,
    );

    const studentDtos: ClassReportStudentDto[] = students.map((s) => {
      const summary = summaryMap.get(s.id);
      const total = summary?.totalDays || 1;
      const pct = summary
        ? Math.round(((summary.presentDays + summary.lateDays) / total) * 100)
        : 0;
      return new ClassReportStudentDto({
        studentId: s.id,
        studentName: profileMap.get(s.user_id || '') ?? 'Unknown',
        presentDays: summary?.presentDays ?? 0,
        totalDays: summary?.totalDays ?? 0,
        attendancePercentage: pct,
      });
    });

    return {
      data: new ClassReportDto({
        classSectionId,
        className,
        sectionName,
        academicYearId: yearId,
        students: studentDtos,
      }),
    };
  }

  async getRankings(
    classSectionId: string,
    subjectId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: RankingsDto }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;

    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!cs) throw new NotFoundException('Class section not found');

    const c = cs as { class_id: string; section_id: string };
    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('name')
      .eq('id', subjectId)
      .maybeSingle();
    const subjectName = (subjectRow as { name?: string } | null)?.name ?? 'Unknown';

    const { data: students } = await supabase
      .from('students')
      .select('id, user_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId);
    const studentIds = (students || []).map((s: { id: string; user_id: string | null }) => s.id);
    const userIds = (students || []).map((s) => s.user_id).filter(Boolean) as string[];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
    );

    const { data: assessList } = await supabase
      .from('assessments')
      .select('id, total_marks')
      .eq('class_section_id', classSectionId)
      .eq('subject_id', subjectId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId);
    const assessmentIds = (assessList || []).map((a: { id: string }) => a.id);
    const totalMap = new Map(
      (assessList || []).map((a: { id: string; total_marks: number }) => [a.id, Number(a.total_marks) || 1]),
    );

    if (assessmentIds.length === 0) {
      return {
        data: new RankingsDto({
          classSectionId,
          subjectId,
          subjectName,
          entries: [],
        }),
      };
    }

    const { data: gradeRows } = await supabase
      .from('student_grades')
      .select('student_id, marks_obtained, assessment_id')
      .in('student_id', studentIds)
      .in('assessment_id', assessmentIds);

    const studentScores = new Map<string, { sum: number; total: number }>();
    for (const row of gradeRows || []) {
      const r = row as { student_id: string; marks_obtained: number; assessment_id: string };
      const total = totalMap.get(r.assessment_id) ?? 1;
      const current = studentScores.get(r.student_id) || { sum: 0, total: 0 };
      current.sum += Number(r.marks_obtained);
      current.total += total;
      studentScores.set(r.student_id, current);
    }

    const withPct = [...studentScores.entries()].map(([sid, v]) => ({
      studentId: sid,
      percentage: v.total > 0 ? Math.round((v.sum / v.total) * 100) : 0,
      marksObtained: v.sum,
      totalMarks: v.total,
    }));
    withPct.sort((a, b) => b.percentage - a.percentage);

    const studentIdToName = new Map(
      (students as { id: string; user_id: string | null }[]).map((s) => [
        s.id,
        profileMap.get(s.user_id ?? '') ?? 'Unknown',
      ]),
    );
    const n = withPct.length;
    const entries: RankingEntryDto[] = withPct.map((item, index) => {
      const rank = index + 1;
      const percentile = n > 0 && rank > 3 ? Math.round(((n - rank + 1) / n) * 100) : undefined;
      return new RankingEntryDto({
        studentId: item.studentId,
        studentName: studentIdToName.get(item.studentId) ?? 'Unknown',
        marksObtained: item.marksObtained,
        totalMarks: item.totalMarks,
        percentage: item.percentage,
        rank: rank <= 3 ? rank : undefined,
        percentile,
      });
    });

    return {
      data: new RankingsDto({
        classSectionId,
        subjectId,
        subjectName,
        entries,
      }),
    };
  }

  async exportStudentReportPdf(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    const { data: report } = await this.getStudentReport(studentId, branchId, academicYearId);
    const PDFDocument = require('pdfkit');
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50 });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    await new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', reject);
      doc.fontSize(18).text(`Student Report: ${report.studentName}`, { continued: false });
      doc.fontSize(10).text(`Academic Year: ${report.academicYearName}`, { continued: false });
      doc.moveDown();
      if (report.academic?.entries?.length) {
        doc.fontSize(12).text('Academic', { continued: false });
        report.academic.entries.forEach((e) => {
          doc.fontSize(10).text(
            `${e.subjectName} - ${e.assessmentTitle}: ${e.marksObtained}/${e.totalMarks} (${e.percentage}%) ${e.letterGrade ?? ''}`,
            { continued: false },
          );
        });
        doc.moveDown();
      }
      if (report.attendance) {
        doc.fontSize(12).text('Attendance', { continued: false });
        doc
          .fontSize(10)
          .text(
            `Present: ${report.attendance.presentDays}, Absent: ${report.attendance.absentDays}, Late: ${report.attendance.lateDays}, Excused: ${report.attendance.excusedDays}. Total: ${report.attendance.totalDays} days, ${report.attendance.percentage}%`,
            { continued: false },
          );
        doc.moveDown();
      }
      if (report.behavioral?.periods?.length) {
        doc.fontSize(12).text('Behavioral', { continued: false });
        report.behavioral.periods.forEach((p) => {
          const line = p.attributes.map((a) => `${a.attributeName}: ${a.average}`).join(', ');
          doc.fontSize(10).text(`${p.period}: ${line}`, { continued: false });
        });
      }
      doc.end();
    });
    return Buffer.concat(chunks);
  }

  async exportStudentReportExcel(
    studentId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    const { data: report } = await this.getStudentReport(studentId, branchId, academicYearId);
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';

    if (report.academic?.entries?.length) {
      const ws = workbook.addWorksheet('Academic', { headerFooter: { firstHeader: report.studentName } });
      ws.columns = [
        { header: 'Subject', key: 'subject', width: 20 },
        { header: 'Assessment', key: 'assessment', width: 30 },
        { header: 'Marks', key: 'marks', width: 12 },
        { header: 'Grade', key: 'grade', width: 8 },
        { header: 'Rank/Percentile', key: 'rank', width: 14 },
      ];
      report.academic.entries.forEach((e) => {
        ws.addRow({
          subject: e.subjectName,
          assessment: e.assessmentTitle,
          marks: `${e.marksObtained}/${e.totalMarks} (${e.percentage}%)`,
          grade: e.letterGrade ?? '',
          rank: e.rank != null ? `Rank ${e.rank}` : e.percentile != null ? `Top ${e.percentile}%` : '',
        });
      });
    }
    if (report.attendance) {
      const ws = workbook.addWorksheet('Attendance');
      ws.addRow(['Metric', 'Value']);
      ws.addRow(['Present', report.attendance.presentDays]);
      ws.addRow(['Absent', report.attendance.absentDays]);
      ws.addRow(['Late', report.attendance.lateDays]);
      ws.addRow(['Excused', report.attendance.excusedDays]);
      ws.addRow(['Total days', report.attendance.totalDays]);
      ws.addRow(['Percentage', `${report.attendance.percentage}%`]);
    }
    if (report.behavioral?.periods?.length) {
      const ws = workbook.addWorksheet('Behavioral');
      const attrs = Array.from(
        new Set(report.behavioral.periods.flatMap((p) => p.attributes.map((a) => a.attributeName))),
      ).sort();
      ws.addRow(['Period', ...attrs]);
      report.behavioral.periods.forEach((p) => {
        const row: (string | number)[] = [p.period];
        const map = Object.fromEntries(p.attributes.map((a) => [a.attributeName, a.average]));
        attrs.forEach((a) => row.push(map[a] ?? ''));
        ws.addRow(row);
      });
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  async exportClassReportExcel(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    const { data: report } = await this.getClassReport(classSectionId, branchId, academicYearId);
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';
    const ws = workbook.addWorksheet('Class Report');
    ws.columns = [
      { header: 'Student', key: 'name', width: 28 },
      { header: 'Present', key: 'present', width: 10 },
      { header: 'Total days', key: 'total', width: 12 },
      { header: 'Attendance %', key: 'pct', width: 14 },
    ];
    report.students.forEach((s) => {
      ws.addRow({
        name: s.studentName,
        present: s.presentDays,
        total: s.totalDays,
        pct: `${s.attendancePercentage}%`,
      });
    });
    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }
}
