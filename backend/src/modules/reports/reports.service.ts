import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { PostgrestError } from '@supabase/supabase-js';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { GradesService } from '../grades/grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { BehavioralService } from '../behavioral/behavioral.service';
import { StudentsService } from '../students/students.service';
import { StudentGradeDto } from '../grades/dto/student-grade.dto';
import puppeteer from 'puppeteer';
import { PdfLogoCacheService } from '../../common/pdf/pdf-logo-cache.service';
import { buildPdfFooterTemplate, buildPdfHeaderTemplate } from '../../common/pdf/pdf-templates';
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
import { QueryReportPeriodDto, ReportPeriodType } from './dto/query-report-period.dto';
import { AssignmentStatisticsDto } from './dto/assignment-statistics.dto';
import { AssignmentEngagementDto } from './dto/assignment-engagement.dto';
import { ClassStudentCountDto } from './dto/class-student-count.dto';
import { AttendanceReportByClassDto, AttendanceReportStudentRowDto } from './dto/attendance-report-by-class.dto';
import { AttendanceSummaryBranchDto, AttendanceSummaryClassItemDto } from './dto/attendance-summary-branch.dto';
import { LowAttendanceReportDto, LowAttendanceStudentDto } from './dto/low-attendance.dto';
import { QueryAttendanceReportDto } from './dto/query-attendance-report.dto';
import {
  AcademicReportBySubjectDto,
  SubjectClassPerformanceDto,
} from './dto/academic-report-by-subject.dto';
import {
  AcademicComparisonDto,
  AcademicComparisonItemDto,
} from './dto/academic-comparison.dto';

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

function getPuppeteerExecutablePath(): string | undefined {
  return (
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH ||
    undefined
  );
}

type ExportFilterQuery = { include?: string; exclude?: string };

function parseCsvSet(value?: string): Set<string> | null {
  if (!value) return null;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? new Set(parts) : null;
}

function buildInclusionChecker(
  allowedKeys: readonly string[],
  filter?: ExportFilterQuery,
): (key: string) => boolean {
  const allowed = new Set(allowedKeys);
  const includeRaw = parseCsvSet(filter?.include);
  const excludeRaw = parseCsvSet(filter?.exclude);

  const include = includeRaw ? new Set([...includeRaw].filter((k) => allowed.has(k))) : null;
  const exclude = excludeRaw ? new Set([...excludeRaw].filter((k) => allowed.has(k))) : null;

  return (key: string) => {
    if (!allowed.has(key)) return false;
    if (include && !include.has(key)) return false;
    if (exclude && exclude.has(key)) return false;
    return true;
  };
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
    private readonly pdfLogoCache: PdfLogoCacheService,
  ) {}

  private resolveBranchName(
    row: { name: string; name_translations?: Record<string, string> | null },
    language: string,
  ): string {
    const t = row.name_translations;
    return (t?.[language] ?? t?.en ?? row.name) || row.name;
  }

  private async getPdfBranding(branchId: string, language: string = 'en'): Promise<{
    headerTemplate: string;
    footerTemplate: string;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, name_translations, tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    const branchRow = branch as
      | { id: string; name: string; name_translations?: Record<string, string> | null; tenant_id: string | null }
      | null;

    const branchName = branchRow ? this.resolveBranchName(branchRow, language) : '—';
    const tenantId = branchRow?.tenant_id ?? null;

    let tenantLogoUrl: string | null = null;
    let tenantName: string | null = null;
    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, logo_url')
        .eq('id', tenantId)
        .maybeSingle();
      const tenantRow = tenant as { name?: string | null; logo_url?: string | null } | null;
      tenantLogoUrl = tenantRow?.logo_url ?? null;
      tenantName = tenantRow?.name ?? null;
    }

    const ntgLogoDataUrl = await this.pdfLogoCache.getNtgLogoDataUrl();
    const tenantLogoDataUrl = tenantId
      ? await this.pdfLogoCache.getTenantLogoDataUrl(tenantId, tenantLogoUrl)
      : undefined;

    const schoolAndBranchName =
      tenantName?.trim()
        ? `${tenantName.trim()} - ${branchName}`
        : branchName;

    return {
      headerTemplate: buildPdfHeaderTemplate({
        ntgLogoDataUrl,
        branchName: schoolAndBranchName,
        tenantLogoDataUrl,
      }),
      footerTemplate: buildPdfFooterTemplate(),
    };
  }

  /**
   * Get date range for a given period type.
   * Returns { startDate, endDate } in YYYY-MM-DD format.
   */
  private async getDateRangeForPeriod(
    periodType: ReportPeriodType | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    branchId: string,
    academicYearId: string,
  ): Promise<{ startDate: string; endDate: string } | null> {
    if (periodType === ReportPeriodType.ALL) {
      // "All" = earliest available academic year start (tenant) → today.
      // Uses academic years as the best proxy for when reporting data began.
      const supabase = this.supabaseConfig.getClient();
      const { data: branchRow, error: branchErr } = await supabase
        .from('branches')
        .select('tenant_id')
        .eq('id', branchId)
        .maybeSingle();
      if (branchErr) return null;
      const tenantId = (branchRow as { tenant_id?: string | null } | null)?.tenant_id ?? null;
      const { data: earliest, error } = await supabase
        .from('academic_years')
        .select('start_date')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      const earliestStart =
        (earliest as { start_date?: string } | null)?.start_date?.split('T')[0] ?? null;
      const today = new Date().toISOString().split('T')[0];
      if (!earliestStart) {
        // Fallback to default behaviour if no academic years exist.
        return this.getDateRangeForPeriod(ReportPeriodType.YEAR, undefined, undefined, branchId, academicYearId);
      }
      return { startDate: earliestStart, endDate: today };
    }
    if (!periodType || periodType === ReportPeriodType.YEAR) {
      // Default to academic year - get academic year dates
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) return null;
      const today = new Date().toISOString().split('T')[0];
      const start = activeYear.startDate.split('T')[0];
      // "Year to date" should include up to today even if academic year end is misconfigured in the past.
      // All queries are still scoped by academic_year_id, so using today here is safe and prevents empty YTD.
      const end = today;
      // Guard against misconfigured future-dated academic years where start > end.
      // If we collapse to a single-day range, "Year to date" can show 0% for assignments
      // even though there is data in this academic year (created earlier than today).
      // Since queries are already scoped by academic_year_id, it's safe to widen the start.
      return start <= end
        ? { startDate: start, endDate: end }
        : { startDate: '1900-01-01', endDate: end };
    }

    if (periodType === ReportPeriodType.CUSTOM) {
      if (!startDate || !endDate) return null;
      return { startDate, endDate };
    }

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (periodType === ReportPeriodType.WEEK) {
      // Monday to Sunday of current week
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust Sunday to previous Monday
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() + mondayOffset);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);
    } else if (periodType === ReportPeriodType.MONTH) {
      // First day to last day of current month
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      periodEnd.setHours(23, 59, 59, 999);
    } else {
      return null;
    }

    return {
      startDate: periodStart.toISOString().split('T')[0],
      endDate: periodEnd.toISOString().split('T')[0],
    };
  }

  /**
   * Ensure user can access student report based on their role:
   * - Student: can only access their own report
   * - Parent/Guardian: can only access their children's reports
   * - Teacher: can access reports for students in classes they teach
   * - Admin/Staff: can access all reports
   */
  async ensureUserCanAccessStudent(
    studentId: string,
    userId: string,
    userRoles?: string[],
  ): Promise<void> {
    if (!userRoles || userRoles.length === 0) {
      return; // No roles, allow (will be handled by auth guard)
    }

    const roles = userRoles.map((r) => r.toLowerCase());
    const isStudent = roles.some((r) => r === 'student');
    const isParent = roles.some((r) => ['parent', 'guardian'].includes(r));
    const isTeacher = roles.some((r) => ['teacher'].includes(r));
    const isAdmin = roles.some((r) => ['admin', 'principal', 'staff'].includes(r));

    // Admin/staff can access all
    if (isAdmin) {
      return;
    }

    const supabase = this.supabaseConfig.getClient();

    // Student can only access their own report
    if (isStudent) {
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('id', studentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!studentRecord) {
        throw new ForbiddenException('You can only access your own report');
      }
      return;
    }

    // Parent/guardian can only access their children's reports
    if (isParent) {
      const { data: parentStudent } = await supabase
        .from('parent_students')
        .select('id')
        .eq('parent_user_id', userId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (!parentStudent) {
        throw new ForbiddenException('You can only access reports for your own children');
      }
      return;
    }

    // Teacher can access if they teach the student's class section
    if (isTeacher) {
      // Get student's class section
      const { data: student } = await supabase
        .from('students')
        .select('class_id, section_id')
        .eq('id', studentId)
        .maybeSingle();

      if (!student || !student.class_id || !student.section_id) {
        throw new NotFoundException('Student class section not found');
      }

      // Get class section ID
      const { data: classSection } = await supabase
        .from('class_sections')
        .select('id, class_teacher_id')
        .eq('class_id', student.class_id)
        .eq('section_id', student.section_id)
        .maybeSingle();

      if (!classSection) {
        throw new NotFoundException('Class section not found');
      }

      // Check if teacher is class teacher
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (staff && classSection.class_teacher_id === staff.id) {
        return; // Is class teacher, allow
      }

      // Check if teacher teaches any subject in this class section
      if (staff) {
        const { data: teacherAssignment } = await supabase
          .from('teacher_assignments')
          .select('id')
          .eq('staff_id', staff.id)
          .eq('class_section_id', classSection.id)
          .limit(1)
          .maybeSingle();

        if (teacherAssignment) {
          return; // Teacher teaches this class section, allow
        }
      }

      throw new ForbiddenException('You can only access reports for students in classes you teach');
    }

    // Default: allow (for other roles or no specific restriction)
  }

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
    // Preferred: year-scoped placement from student_enrolments
    const { data: enrol, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('class_id, section_id')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active')
      .maybeSingle();
    throwIfDbError(enrolErr);

    // Fallback: legacy students table (older data / pre-migration screens)
    const placement =
      enrol && (enrol as { class_id: string | null; section_id: string | null }).class_id
        ? (enrol as { class_id: string; section_id: string })
        : (() => {
            // NOTE: students table placement can be stale post-enrolments migration, hence fallback only.
            return null;
          })();

    const legacyPlacement = async (): Promise<{ class_id: string; section_id: string } | null> => {
      const { data: student, error } = await supabase
        .from('students')
        .select('class_id, section_id')
        .eq('id', studentId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .maybeSingle();
      throwIfDbError(error);
      if (!student || !(student as { class_id?: string | null }).class_id) return null;
      return student as { class_id: string; section_id: string };
    };

    const s = placement ?? (await legacyPlacement());
    if (!s?.class_id) return null;

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
    periodParams?: QueryReportPeriodDto,
  ): Promise<{ data: StudentReportDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;

    const student = await this.studentsService.getStudentById(studentId, branchId);

    // Get date range for period filtering
    // For "Year to date", we still need a real date window (academic-year start → today, clamped)
    // so assignment/behavioural period stats don't accidentally show 0% when the academic year
    // is misconfigured (e.g. future start/end dates).
    //
    // Note: PDF/Excel exports call getStudentReport without periodParams, so exports remain
    // full academic-year by default unless the export endpoint passes a period explicitly.
    const dateRange = periodParams?.periodType
      ? await this.getDateRangeForPeriod(
          periodParams.periodType,
          periodParams.startDate,
          periodParams.endDate,
          branchId,
          yearId,
        )
      : null;

    const [grades, attendanceSummary, behavioralRes] = await Promise.all([
      this.gradesService.getGradesByStudent(studentId, branchId).catch(() => [] as StudentGradeDto[]),
      this.attendanceService.getAttendanceSummaryByStudent(
        studentId,
        branchId,
        yearId,
        dateRange?.startDate,
        dateRange?.endDate,
      ),
      this.behavioralService.getByStudent(studentId, branchId, yearId),
    ]);

    // Filter grades by date range if provided
    let filteredGrades = grades;
    if (dateRange && grades.length > 0) {
      // Need to fetch assessments to filter by date
      const supabase = this.supabaseConfig.getClient();
      const assessmentIds = [...new Set(grades.map((g) => g.assessmentId))];
      const { data: assessments } = await supabase
        .from('assessments')
        .select('id, created_at, due_date')
        .in('id', assessmentIds);
      const assessmentDateMap = new Map(
        (assessments || []).map((a: { id: string; created_at: string; due_date: string | null }) => [
          a.id,
          { createdAt: a.created_at, dueDate: a.due_date },
        ]),
      );
      filteredGrades = grades.filter((g) => {
        const assessment = assessmentDateMap.get(g.assessmentId);
        if (!assessment) return false;
        const assessmentDate = assessment.dueDate || assessment.createdAt;
        const dateStr = assessmentDate.split('T')[0];
        return dateStr >= dateRange.startDate && dateStr <= dateRange.endDate;
      });
    }

    const academic = await this.buildAcademicSection(
      filteredGrades,
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
    
    // Filter behavioral by date range if provided
    let behavioral = this.buildBehavioralSection(behavioralRes.data);
    if (dateRange && behavioral.periods.length > 0) {
      behavioral = new BehavioralSectionDto({
        periods: behavioral.periods.filter((p) => {
          const periodDate = `${p.period}-01`;
          return periodDate >= dateRange.startDate && periodDate <= dateRange.endDate;
        }),
      });
    }

    // Build assignment statistics and engagement
    const [assignmentStatistics, assignmentEngagement] = await Promise.all([
      this.buildAssignmentStatisticsSection(studentId, branchId, yearId, dateRange),
      this.buildAssignmentEngagementSection(studentId, branchId, yearId, dateRange),
    ]);

    return {
      data: new StudentReportDto({
        studentId,
        studentName: [student.firstName, student.lastName].filter(Boolean).join(' ') || 'Unknown',
        academicYearId: yearId,
        academicYearName: activeYear.name,
        academic,
        attendance,
        behavioral,
        assignmentStatistics: assignmentStatistics || undefined,
        assignmentEngagement: assignmentEngagement.length > 0 ? assignmentEngagement : undefined,
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
    const { data: enrolments } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');
    const studentIds = (enrolments || []).map((s: { student_id: string }) => s.student_id);
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
    const { data: enrolments } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('status', 'active');
    const studentIds = (enrolments || []).map((s: { student_id: string }) => s.student_id);
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

  /**
   * Build assignment statistics section for a student.
   */
  private async buildAssignmentStatisticsSection(
    studentId: string,
    branchId: string,
    academicYearId: string,
    dateRange: { startDate: string; endDate: string } | null,
  ): Promise<AssignmentStatisticsDto | null> {
    const supabase = this.supabaseConfig.getClient();

    // Get student's class section
    const classSectionId = await this.getStudentClassSectionId(studentId, branchId, academicYearId);
    if (!classSectionId) {
      return null; // Student not in a class section
    }

    // Build query for assessments
    let assessmentsQuery = supabase
      .from('assessments')
      .select('id')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('is_published', true);

    // Filter by date range if provided
    if (dateRange) {
      // created_at is timestamptz; compare using full-day bounds to avoid excluding same-day rows.
      const startTs = `${dateRange.startDate}T00:00:00.000Z`;
      const endTs = `${dateRange.endDate}T23:59:59.999Z`;
      assessmentsQuery = assessmentsQuery
        .gte('created_at', startTs)
        .lte('created_at', endTs);
    }

    const { data: assessments } = await assessmentsQuery;
    const assessmentIds = (assessments || []).map((a: { id: string }) => a.id);
    if (assessmentIds.length === 0) {
      return new AssignmentStatisticsDto({
        totalAssignments: 0,
        viewedAssignments: 0,
        notViewedAssignments: 0,
        submittedAssignments: 0,
        inProgressAssignments: 0,
        notStartedAssignments: 0,
        viewingRate: 0,
        submissionRate: 0,
      });
    }

    // Get student's statuses for these assessments (if assignment engagement feature is used)
    const { data: statuses } = await supabase
      .from('student_assessment_statuses')
      .select('assessment_id, status, is_read')
      .eq('student_id', studentId)
      .in('assessment_id', assessmentIds);

    const statusMap = new Map(
      (statuses || []).map((s: { assessment_id: string; status: string; is_read: boolean }) => [
        s.assessment_id,
        { status: s.status, isRead: s.is_read },
      ]),
    );

    // Grades are the canonical "teacher has graded" signal in this system.
    // When student_assessment_statuses isn't populated, fall back to student_grades to compute submission-like stats.
    const { data: gradeRows } = await supabase
      .from('student_grades')
      .select('assessment_id')
      .eq('branch_id', branchId)
      .eq('student_id', studentId)
      .in('assessment_id', assessmentIds);
    const gradedAssessmentIds = new Set(
      (gradeRows || [])
        .map((g: { assessment_id: string | null }) => g.assessment_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );

    let totalAssignments = assessmentIds.length;
    let viewedAssignments = 0;
    let submittedAssignments = 0;
    let inProgressAssignments = 0;
    let notStartedAssignments = 0;

    for (const assessmentId of assessmentIds) {
      const status = statusMap.get(assessmentId);
      if (status?.isRead) {
        viewedAssignments++;
      }
      const hasGrade = gradedAssessmentIds.has(assessmentId);
      if (status?.status === 'submitted' || hasGrade) {
        submittedAssignments++;
      } else if (status?.status === 'in_progress') {
        inProgressAssignments++;
      } else {
        notStartedAssignments++;
      }
    }

    const notViewedAssignments = totalAssignments - viewedAssignments;
    const viewingRate = totalAssignments > 0 ? Math.round((viewedAssignments / totalAssignments) * 100) : 0;
    const submissionRate = totalAssignments > 0 ? Math.round((submittedAssignments / totalAssignments) * 100) : 0;

    return new AssignmentStatisticsDto({
      totalAssignments,
      viewedAssignments,
      notViewedAssignments,
      submittedAssignments,
      inProgressAssignments,
      notStartedAssignments,
      viewingRate,
      submissionRate,
    });
  }

  /**
   * Build assignment engagement section for a student.
   */
  private async buildAssignmentEngagementSection(
    studentId: string,
    branchId: string,
    academicYearId: string,
    dateRange: { startDate: string; endDate: string } | null,
  ): Promise<AssignmentEngagementDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Get student's class section
    const classSectionId = await this.getStudentClassSectionId(studentId, branchId, academicYearId);
    if (!classSectionId) {
      return []; // Student not in a class section
    }

    // Build query for assessments
    let assessmentsQuery = supabase
      .from('assessments')
      .select('id, title, due_date, subject_id, created_at')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('is_published', true);

    // Filter by date range if provided
    if (dateRange) {
      // created_at is timestamptz; compare using full-day bounds to avoid excluding same-day rows.
      const startTs = `${dateRange.startDate}T00:00:00.000Z`;
      const endTs = `${dateRange.endDate}T23:59:59.999Z`;
      assessmentsQuery = assessmentsQuery
        .gte('created_at', startTs)
        .lte('created_at', endTs);
    }

    const { data: assessments } = await assessmentsQuery;
    if (!assessments || assessments.length === 0) {
      return [];
    }

    const assessmentIds = assessments.map((a: { id: string }) => a.id);

    // Get subjects
    const subjectIds = [...new Set(assessments.map((a: { subject_id: string }) => a.subject_id))];
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name')
      .in('id', subjectIds);
    const subjectMap = new Map(
      (subjects || []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );

    // Get student's statuses for these assessments
    const { data: statuses } = await supabase
      .from('student_assessment_statuses')
      .select('assessment_id, status, is_read, updated_at')
      .eq('student_id', studentId)
      .in('assessment_id', assessmentIds);

    const statusMap = new Map(
      (statuses || []).map((s: {
        assessment_id: string;
        status: string;
        is_read: boolean;
        updated_at: string;
      }) => [
        s.assessment_id,
        { status: s.status, isRead: s.is_read, updatedAt: s.updated_at },
      ]),
    );

    // Get graded status from student_grades table
    const { data: grades } = await supabase
      .from('student_grades')
      .select('assessment_id, graded_at')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .in('assessment_id', assessmentIds);

    const gradedMap = new Map(
      (grades || []).map((g: { assessment_id: string; graded_at: string | null }) => [
        g.assessment_id,
        !!g.graded_at, // true if graded_at is not null
      ]),
    );

    const now = new Date();
    const engagement: AssignmentEngagementDto[] = [];

    for (const assessment of assessments) {
      const a = assessment as {
        id: string;
        title: string;
        due_date: string | null;
        subject_id: string;
        created_at: string;
      };
      const status = statusMap.get(a.id);
      const isGraded = gradedMap.get(a.id) ?? false;

      const isViewed = status?.isRead ?? false;
      const viewedAt = status?.isRead ? status.updatedAt : undefined;
      const assignmentStatus = (status?.status as 'not_started' | 'in_progress' | 'submitted') || 'not_started';
      const submittedAt = assignmentStatus === 'submitted' ? status?.updatedAt : undefined;

      // Calculate days until due
      let daysUntilDue: number | undefined;
      if (a.due_date) {
        const dueDate = new Date(a.due_date);
        const diffTime = dueDate.getTime() - now.getTime();
        daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Calculate engagement score:
      // - Viewed: 30%
      // - In Progress: +30% (total 60%)
      // - Submitted (not graded): +50% (total 80%)
      // - Submitted + Graded: 100% (overrides all)
      let engagementScore = 0;
      if (assignmentStatus === 'submitted' && isGraded) {
        engagementScore = 100; // Graded = 100%
      } else {
        if (isViewed) engagementScore += 30;
        if (assignmentStatus === 'in_progress') engagementScore += 30;
        if (assignmentStatus === 'submitted') {
          engagementScore += 50; // Total: 80% (30% viewed + 50% submitted)
        }
      }

      engagement.push(
        new AssignmentEngagementDto({
          assignmentId: a.id,
          assignmentTitle: a.title,
          subjectName: subjectMap.get(a.subject_id) ?? 'Unknown',
          dueDate: a.due_date || undefined,
          isViewed,
          viewedAt,
          status: assignmentStatus,
          submittedAt,
          daysUntilDue,
          engagementScore,
        }),
      );
    }

    // Sort by engagement score (lowest first) or due date
    engagement.sort((a, b) => {
      if (a.engagementScore !== b.engagementScore) {
        return a.engagementScore - b.engagementScore;
      }
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

    return engagement;
  }

  /**
   * Ensure teacher can only access reports for class sections they teach.
   */
  async ensureTeacherCanAccessClassSection(
    classSectionId: string,
    userId: string,
    userRoles?: string[],
    branchId?: string,
  ): Promise<void> {
    if (!userRoles || userRoles.length === 0) {
      return; // No roles, allow (will be handled by auth guard)
    }

    const roles = userRoles.map((r) => r.toLowerCase());
    const isTeacher = roles.some((r) => r === 'teacher');
    const isAdmin = roles.some((r) => ['admin', 'principal', 'staff'].includes(r));

    // Admin/staff can access all
    if (isAdmin) {
      return;
    }

    // If not a teacher, allow (other roles handled elsewhere)
    if (!isTeacher) {
      return;
    }

    const supabase = this.supabaseConfig.getClient();

    // Get staff record for user
    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!staff) {
      throw new ForbiddenException('Staff record not found');
    }

    // Check if teacher is class teacher
    const { data: classSection } = await supabase
      .from('class_sections')
      .select('id, class_teacher_id')
      .eq('id', classSectionId)
      .maybeSingle();

    if (!classSection) {
      throw new NotFoundException('Class section not found');
    }

    if (classSection.class_teacher_id === staff.id) {
      return; // Is class teacher, allow
    }

    // Check if teacher teaches any subject in this class section
    const { data: teacherAssignment } = await supabase
      .from('teacher_assignments')
      .select('id')
      .eq('staff_id', staff.id)
      .eq('class_section_id', classSectionId)
      .limit(1)
      .maybeSingle();

    if (teacherAssignment) {
      return; // Teacher teaches this class section, allow
    }

    throw new ForbiddenException('You can only access reports for class sections you teach');
  }

  /**
   * Get list of class section IDs the user is allowed to see for admin reports.
   * school_admin, principal, super_admin, admin_assistant → all in branch.
   * academic_coordinator → all in branch.
   * class_teacher → only class sections where they are class_teacher_id.
   * subject_teacher → only class sections from teacher_assignments.
   * Others (parent, student, etc.) → empty array.
   */
  async getAllowedClassSectionIdsForAdminReports(
    userId: string,
    userRoles: string[] | undefined,
    branchId: string,
    academicYearId: string,
  ): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const roles = (userRoles || []).map((r) => String(r).toLowerCase());

    const isFullAccess = roles.some((r) =>
      ['school_admin', 'principal', 'super_admin', 'admin_assistant', 'academic_coordinator'].includes(r),
    );
    if (isFullAccess) {
      const { data: list } = await supabase
        .from('class_sections')
        .select('id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId);
      return (list || []).map((r: { id: string }) => r.id);
    }

    const isClassTeacher = roles.includes('class_teacher');
    const isSubjectTeacher = roles.includes('subject_teacher');
    if (!isClassTeacher && !isSubjectTeacher) {
      return [];
    }

    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!staff) return [];

    const staffId = (staff as { id: string }).id;
    const sectionIds: string[] = [];

    if (isClassTeacher) {
      const { data: asClassTeacher } = await supabase
        .from('class_sections')
        .select('id')
        .eq('class_teacher_id', staffId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId);
      (asClassTeacher || []).forEach((r: { id: string }) => sectionIds.push(r.id));
    }
    if (isSubjectTeacher) {
      const { data: assigned } = await supabase
        .from('teacher_assignments')
        .select('class_section_id')
        .eq('staff_id', staffId);
      const csIds = (assigned || [])
        .map((r: { class_section_id: string }) => r.class_section_id)
        .filter((id) => !sectionIds.includes(id));
      const { data: valid } = await supabase
        .from('class_sections')
        .select('id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', academicYearId)
        .in('id', csIds);
      (valid || []).forEach((r: { id: string }) => sectionIds.push(r.id));
    }

    return [...new Set(sectionIds)];
  }

  /**
   * Get list of subject IDs the user is allowed to see for admin academic reports.
   * Full access roles → all subjects in branch; subject_teacher → only assigned subjects.
   */
  async getAllowedSubjectIdsForAdminReports(
    userId: string,
    userRoles: string[] | undefined,
    branchId: string,
  ): Promise<string[]> {
    const supabase = this.supabaseConfig.getClient();
    const roles = (userRoles || []).map((r) => String(r).toLowerCase());

    const isFullAccess = roles.some((r) =>
      ['school_admin', 'principal', 'super_admin', 'admin_assistant', 'academic_coordinator'].includes(r),
    );
    if (isFullAccess) {
      const { data: list } = await supabase
        .from('subjects')
        .select('id')
        .eq('branch_id', branchId);
      return (list || []).map((r: { id: string }) => r.id);
    }

    if (!roles.includes('subject_teacher')) return [];

    const { data: staff } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (!staff) return [];

    const { data: assigned } = await supabase
      .from('teacher_assignments')
      .select('subject_id')
      .eq('staff_id', (staff as { id: string }).id);
    const subjectIds = [...new Set((assigned || []).map((r: { subject_id: string }) => r.subject_id))];
    return subjectIds;
  }

  async getAttendanceReportByClass(
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<{ data: AttendanceReportByClassDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const allowed = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
    if (!allowed.includes(classSectionId)) {
      throw new ForbiddenException('You do not have access to this class section report');
    }

    const raw = await this.attendanceService.getAttendanceReportByClassSection(
      classSectionId,
      branchId,
      yearId,
      startDate,
      endDate,
    );

    const studentIds = raw.students.map((s) => s.studentId);
    const { data: students } = await this.supabaseConfig
      .getClient()
      .from('students')
      .select('id, user_id')
      .in('id', studentIds);
    const userIds = (students || [])
      .map((s: { user_id: string | null }) => s.user_id)
      .filter(Boolean) as string[];
    const profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await this.supabaseConfig
        .getClient()
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profiles || []).forEach((p: { id: string; full_name: string }) => profileMap.set(p.id, p.full_name));
    }
    const studentIdToUserId = new Map(
      (students || []).map((s: { id: string; user_id: string | null }) => [s.id, s.user_id]),
    );

    const studentDtos = raw.students.map(
      (s) =>
        new AttendanceReportStudentRowDto({
          ...s,
          studentName: studentIdToUserId.get(s.studentId)
            ? profileMap.get(studentIdToUserId.get(s.studentId)!) ?? 'Unknown'
            : 'Unknown',
        }),
    );

    return {
      data: new AttendanceReportByClassDto({
        classSectionId: raw.classSectionId,
        className: raw.className,
        sectionName: raw.sectionName,
        startDate: raw.startDate,
        endDate: raw.endDate,
        students: studentDtos,
        classSummary: raw.classSummary,
      }),
    };
  }

  async getAttendanceSummaryBranch(
    branchId: string,
    startDate: string,
    endDate: string,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<{ data: AttendanceSummaryBranchDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = activeYear.id;

    const allowed = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
    if (allowed.length === 0) {
      return {
        data: new AttendanceSummaryBranchDto({
          startDate,
          endDate,
          byClass: [],
          overall: {
            averageAttendance: 0,
            totalStudents: 0,
            totalPresent: 0,
            totalAbsent: 0,
            totalLate: 0,
            totalExcused: 0,
          },
        }),
      };
    }

    const raws = await Promise.all(
      allowed.map((csId) =>
        this.attendanceService.getAttendanceReportByClassSection(
          csId,
          branchId,
          yearId,
          startDate,
          endDate,
        ),
      ),
    );

    const byClass: AttendanceSummaryClassItemDto[] = [];
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;
    let totalStudents = 0;

    for (const raw of raws) {
      byClass.push(
        new AttendanceSummaryClassItemDto({
          classSectionId: raw.classSectionId,
          className: raw.className,
          sectionName: raw.sectionName,
          averageAttendance: raw.classSummary.averageAttendance,
          studentCount: raw.classSummary.studentCount,
          totalPresent: raw.classSummary.totalPresent,
          totalAbsent: raw.classSummary.totalAbsent,
          totalLate: raw.classSummary.totalLate,
          totalExcused: raw.classSummary.totalExcused,
        }),
      );
      totalPresent += raw.classSummary.totalPresent;
      totalAbsent += raw.classSummary.totalAbsent;
      totalLate += raw.classSummary.totalLate;
      totalExcused += raw.classSummary.totalExcused;
      totalStudents += raw.classSummary.studentCount;
    }

    const totalDays = totalPresent + totalAbsent + totalLate + totalExcused;
    const averageAttendance =
      byClass.length > 0
        ? Math.round(byClass.reduce((sum, c) => sum + c.averageAttendance, 0) / byClass.length)
        : 0;

    return {
      data: new AttendanceSummaryBranchDto({
        startDate,
        endDate,
        byClass,
        overall: {
          averageAttendance,
          totalStudents,
          totalPresent,
          totalAbsent,
          totalLate,
          totalExcused,
        },
      }),
    };
  }

  async getLowAttendanceStudents(
    branchId: string,
    startDate: string,
    endDate: string,
    threshold: number,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<{ data: LowAttendanceReportDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = activeYear.id;

    const allowed = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
    const lowList: LowAttendanceStudentDto[] = [];

    const raws = await Promise.all(
      allowed.map((csId) =>
        this.attendanceService.getAttendanceReportByClassSection(
          csId,
          branchId,
          yearId,
          startDate,
          endDate,
        ),
      ),
    );

    const allStudentIds = [...new Set(raws.flatMap((r) => r.students.map((s) => s.studentId)))];
    const supabase = this.supabaseConfig.getClient();

    const { data: studentsData } =
      allStudentIds.length > 0
        ? await supabase.from('students').select('id, user_id').in('id', allStudentIds)
        : { data: [] as { id: string; user_id: string | null }[] };
    const students = studentsData || [];
    const userIds = [...new Set(students.map((s) => s.user_id).filter(Boolean) as string[])];
    const profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profiles || []).forEach((p: { id: string; full_name: string }) => profileMap.set(p.id, p.full_name));
    }
    const studentIdToUserId = new Map(students.map((s) => [s.id, s.user_id]));

    for (const raw of raws) {
      for (const s of raw.students) {
        if (s.percentage < threshold && s.totalDays > 0) {
          lowList.push(
            new LowAttendanceStudentDto({
              studentId: s.studentId,
              studentName: studentIdToUserId.get(s.studentId)
                ? profileMap.get(studentIdToUserId.get(s.studentId)!) ?? 'Unknown'
                : 'Unknown',
              classSectionId: raw.classSectionId,
              className: raw.className,
              sectionName: raw.sectionName,
              percentage: s.percentage,
              presentDays: s.presentDays,
              absentDays: s.absentDays,
              totalDays: s.totalDays,
              belowThreshold: threshold,
            }),
          );
        }
      }
    }

    return {
      data: new LowAttendanceReportDto({
        startDate,
        endDate,
        threshold,
        students: lowList,
      }),
    };
  }

  async exportAttendanceReportPdf(
    branchId: string,
    academicYearId: string | undefined,
    startDate: string,
    endDate: string,
    classSectionId: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
    filter?: ExportFilterQuery,
  ): Promise<Buffer> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    if (classSectionId) {
      const allowed = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
      if (!allowed.includes(classSectionId)) throw new ForbiddenException('Access denied');
      const { data: report } = await this.getAttendanceReportByClass(
        classSectionId,
        branchId,
        yearId,
        startDate,
        endDate,
        userId,
        userRoles,
      );
      return this.renderAttendanceReportPdf(report, branchId, filter);
    }

    const { data: summary } = await this.getAttendanceSummaryBranch(
      branchId,
      startDate,
      endDate,
      userId,
      userRoles,
    );
    return this.renderAttendanceSummaryPdf(summary, branchId, filter);
  }

  private async renderAttendanceReportPdf(
    report: AttendanceReportByClassDto,
    branchId: string,
    filter?: ExportFilterQuery,
  ): Promise<Buffer> {
    const shouldInclude = buildInclusionChecker(
      ['present', 'absent', 'late', 'excused', 'total', 'percentage'] as const,
      filter,
    );
    let htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:8px;text-align:left;}
th{background:#eee;}
</style></head>
<body>
<h2>Attendance Report - ${this.escapeHtml(report.className)} ${this.escapeHtml(report.sectionName)}</h2>
<p>Period: ${report.startDate} to ${report.endDate}</p>
<table>
<tr>
  <th>Student</th>
  ${shouldInclude('present') ? '<th>Present</th>' : ''}
  ${shouldInclude('absent') ? '<th>Absent</th>' : ''}
  ${shouldInclude('late') ? '<th>Late</th>' : ''}
  ${shouldInclude('excused') ? '<th>Excused</th>' : ''}
  ${shouldInclude('total') ? '<th>Total</th>' : ''}
  ${shouldInclude('percentage') ? '<th>%</th>' : ''}
</tr>
`;
    report.students.forEach((s) => {
      htmlContent += `<tr>
<td>${this.escapeHtml(s.studentName)}</td>
${shouldInclude('present') ? `<td>${s.presentDays}</td>` : ''}
${shouldInclude('absent') ? `<td>${s.absentDays}</td>` : ''}
${shouldInclude('late') ? `<td>${s.lateDays}</td>` : ''}
${shouldInclude('excused') ? `<td>${s.excusedDays}</td>` : ''}
${shouldInclude('total') ? `<td>${s.totalDays}</td>` : ''}
${shouldInclude('percentage') ? `<td>${s.percentage}%</td>` : ''}
</tr>
`;
    });
    htmlContent += `</table><p>Class average: ${report.classSummary.averageAttendance}% | Students: ${report.classSummary.studentCount}</p></body></html>`;
    const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
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
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: { top: '85px', right: '20px', bottom: '55px', left: '20px' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private async renderAttendanceSummaryPdf(
    summary: AttendanceSummaryBranchDto,
    branchId: string,
    filter?: ExportFilterQuery,
  ): Promise<Buffer> {
    const shouldInclude = buildInclusionChecker(
      ['avg', 'students', 'present', 'absent', 'late', 'excused'] as const,
      filter,
    );
    let htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:8px;text-align:left;}
th{background:#eee;}
</style></head>
<body>
<h2>Branch Attendance Summary</h2>
<p>Period: ${summary.startDate} to ${summary.endDate}</p>
<table>
<tr>
  <th>Class</th>
  <th>Section</th>
  ${shouldInclude('avg') ? '<th>Avg %</th>' : ''}
  ${shouldInclude('students') ? '<th>Students</th>' : ''}
  ${shouldInclude('present') ? '<th>Present</th>' : ''}
  ${shouldInclude('absent') ? '<th>Absent</th>' : ''}
  ${shouldInclude('late') ? '<th>Late</th>' : ''}
  ${shouldInclude('excused') ? '<th>Excused</th>' : ''}
</tr>
`;
    summary.byClass.forEach((c) => {
      htmlContent += `<tr>
<td>${this.escapeHtml(c.className)}</td>
<td>${this.escapeHtml(c.sectionName)}</td>
${shouldInclude('avg') ? `<td>${c.averageAttendance}%</td>` : ''}
${shouldInclude('students') ? `<td>${c.studentCount}</td>` : ''}
${shouldInclude('present') ? `<td>${c.totalPresent}</td>` : ''}
${shouldInclude('absent') ? `<td>${c.totalAbsent}</td>` : ''}
${shouldInclude('late') ? `<td>${c.totalLate}</td>` : ''}
${shouldInclude('excused') ? `<td>${c.totalExcused}</td>` : ''}
</tr>
`;
    });
    htmlContent += `</table><p>Overall average: ${summary.overall.averageAttendance}% | Total students: ${summary.overall.totalStudents}</p></body></html>`;
    const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
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
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: { top: '85px', right: '20px', bottom: '55px', left: '20px' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  async exportAttendanceReportExcel(
    branchId: string,
    academicYearId: string | undefined,
    startDate: string,
    endDate: string,
    classSectionId: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<Buffer> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';

    if (classSectionId) {
      const allowed = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
      if (!allowed.includes(classSectionId)) throw new ForbiddenException('Access denied');
      const { data: report } = await this.getAttendanceReportByClass(
        classSectionId,
        branchId,
        yearId,
        startDate,
        endDate,
        userId,
        userRoles,
      );
      const ws = workbook.addWorksheet('Attendance Data');
      ws.columns = [
        { header: 'Student', key: 'name', width: 28 },
        { header: 'Present', key: 'present', width: 10 },
        { header: 'Absent', key: 'absent', width: 10 },
        { header: 'Late', key: 'late', width: 8 },
        { header: 'Excused', key: 'excused', width: 10 },
        { header: 'Total', key: 'total', width: 8 },
        { header: '%', key: 'pct', width: 8 },
      ];
      report.students.forEach((s) => {
        ws.addRow({
          name: s.studentName,
          present: s.presentDays,
          absent: s.absentDays,
          late: s.lateDays,
          excused: s.excusedDays,
          total: s.totalDays,
          pct: `${s.percentage}%`,
        });
      });
    } else {
      const { data: summary } = await this.getAttendanceSummaryBranch(
        branchId,
        startDate,
        endDate,
        userId,
        userRoles,
      );
      const ws = workbook.addWorksheet('Attendance Summary');
      ws.columns = [
        { header: 'Class', key: 'className', width: 20 },
        { header: 'Section', key: 'sectionName', width: 12 },
        { header: 'Avg %', key: 'avg', width: 10 },
        { header: 'Students', key: 'count', width: 10 },
        { header: 'Present', key: 'present', width: 10 },
        { header: 'Absent', key: 'absent', width: 10 },
        { header: 'Late', key: 'late', width: 8 },
        { header: 'Excused', key: 'excused', width: 10 },
      ];
      summary.byClass.forEach((c) => {
        ws.addRow({
          className: c.className,
          sectionName: c.sectionName,
          avg: `${c.averageAttendance}%`,
          count: c.studentCount,
          present: c.totalPresent,
          absent: c.totalAbsent,
          late: c.totalLate,
          excused: c.totalExcused,
        });
      });
    }

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  /** Administrative academic report by class: reuse class report with allowed check. */
  async getAcademicReportByClass(
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<{ data: ClassReportDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;
    const allowed = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
    if (!allowed.includes(classSectionId)) {
      throw new ForbiddenException('You do not have access to this class section report');
    }
    return this.getClassReport(classSectionId, branchId, yearId, userId, userRoles);
  }

  /** Subject performance across allowed class sections. */
  async getAcademicReportBySubject(
    subjectId: string,
    branchId: string,
    academicYearId: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<{ data: AcademicReportBySubjectDto }> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const [allowedSections, allowedSubjects] = await Promise.all([
      this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId),
      this.getAllowedSubjectIdsForAdminReports(userId, userRoles, branchId),
    ]);
    if (!allowedSubjects.includes(subjectId)) {
      throw new ForbiddenException('You do not have access to this subject report');
    }

    const { data: subjectRow } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('id', subjectId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!subjectRow) throw new NotFoundException('Subject not found');
    const subjectName = (subjectRow as { name?: string }).name ?? 'Unknown';

    const byClass: SubjectClassPerformanceDto[] = [];
    for (const csId of allowedSections) {
      const { data: cs } = await supabase
        .from('class_sections')
        .select('id, class_id, section_id')
        .eq('id', csId)
        .single();
      if (!cs) continue;
      const c = cs as { class_id: string; section_id: string };
      const [classRes, sectionRes, studentsRes] = await Promise.all([
        supabase.from('classes').select('display_name').eq('id', c.class_id).single(),
        supabase.from('sections').select('name').eq('id', c.section_id).single(),
        supabase
          .from('student_enrolments')
          .select('student_id')
          .eq('class_id', c.class_id)
          .eq('section_id', c.section_id)
          .eq('branch_id', branchId)
          .eq('academic_year_id', yearId)
          .eq('status', 'active'),
      ]);
      const className = (classRes.data as { display_name?: string } | null)?.display_name ?? '';
      const sectionName = (sectionRes.data as { name?: string } | null)?.name ?? '';
      const studentIds = ((studentsRes.data || []) as Array<{ student_id: string }>).map((s) => s.student_id);
      if (studentIds.length === 0) {
        byClass.push(
          new SubjectClassPerformanceDto({
            classSectionId: csId,
            className,
            sectionName,
            averagePercentage: 0,
            studentCount: 0,
            topPerformers: [],
            struggling: [],
          }),
        );
        continue;
      }

      const { data: students } = await supabase
        .from('students')
        .select('id, user_id')
        .in('id', studentIds)
        .eq('branch_id', branchId)
        .eq('is_active', true);
      const studentRows = (students || []) as { id: string; user_id: string | null }[];

      const { data: assessList } = await supabase
        .from('assessments')
        .select('id, total_marks')
        .eq('class_section_id', csId)
        .eq('subject_id', subjectId)
        .eq('branch_id', branchId)
        .eq('academic_year_id', yearId);
      const assessmentIds = (assessList || []).map((a: { id: string }) => a.id);
      const studentPcts = new Map<string, number[]>();
      if (assessmentIds.length > 0) {
        const { data: gradeRows } = await supabase
          .from('student_grades')
          .select('student_id, marks_obtained, assessment_id')
          .in('student_id', studentIds)
          .in('assessment_id', assessmentIds);
        const totalMap = new Map(
          (assessList || []).map((a: { id: string; total_marks: number }) => [a.id, Number(a.total_marks) || 1]),
        );
        for (const row of gradeRows || []) {
          const r = row as { student_id: string; marks_obtained: number; assessment_id: string };
          const total = totalMap.get(r.assessment_id) ?? 1;
          const pct = Math.round((Number(r.marks_obtained) / total) * 100);
          const list = studentPcts.get(r.student_id) || [];
          list.push(pct);
          studentPcts.set(r.student_id, list);
        }
      }
      const averages = new Map<string, number>();
      studentPcts.forEach((pcts, sid) => {
        const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
        averages.set(sid, Math.round(avg));
      });
      const userIds = studentRows.map((s) => s.user_id).filter(Boolean) as string[];
      const profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        (profiles || []).forEach((p: { id: string; full_name: string }) => profileMap.set(p.id, p.full_name));
      }
      const studentIdToName = new Map(
        studentRows.map((s) => [s.id, s.user_id ? profileMap.get(s.user_id) ?? 'Unknown' : 'Unknown']),
      );
      const sorted = [...averages.entries()].sort((a, b) => b[1] - a[1]);
      const top5 = sorted.slice(0, 5).map(([id, pct]) => ({
        studentId: id,
        studentName: studentIdToName.get(id) ?? 'Unknown',
        percentage: pct,
      }));
      const bottom5 = sorted.slice(-5).reverse().map(([id, pct]) => ({
        studentId: id,
        studentName: studentIdToName.get(id) ?? 'Unknown',
        percentage: pct,
      }));
      const avgPct =
        sorted.length > 0
          ? Math.round(sorted.reduce((sum, [, pct]) => sum + pct, 0) / sorted.length)
          : 0;
      byClass.push(
        new SubjectClassPerformanceDto({
          classSectionId: csId,
          className,
          sectionName,
          averagePercentage: avgPct,
          studentCount: sorted.length,
          topPerformers: top5,
          struggling: bottom5,
        }),
      );
    }

    return {
      data: new AcademicReportBySubjectDto({
        subjectId,
        subjectName,
        academicYearId: yearId,
        byClass,
      }),
    };
  }

  /** Compare classes or subjects by average. */
  async getAcademicComparison(
    branchId: string,
    academicYearId: string | undefined,
    classSectionIds: string[] | undefined,
    subjectIds: string[] | undefined,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<{ data: AcademicComparisonDto }> {
    const supabase = this.supabaseConfig.getClient();
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const allowedSections = await this.getAllowedClassSectionIdsForAdminReports(userId, userRoles, branchId, yearId);
    const allowedSubjects = await this.getAllowedSubjectIdsForAdminReports(userId, userRoles, branchId);

    const items: AcademicComparisonItemDto[] = [];

    if (classSectionIds && classSectionIds.length > 0) {
      const filtered = classSectionIds.filter((id) => allowedSections.includes(id));
      for (const csId of filtered) {
        const { data: report } = await this.getClassReport(csId, branchId, yearId, userId, userRoles);
        const avg =
          report.students.length > 0
            ? Math.round(
                report.students.reduce((s, st) => s + (st.averagePercentage ?? 0), 0) / report.students.length,
              )
            : 0;
        items.push({
          id: csId,
          name: `${report.className} ${report.sectionName}`,
          averagePercentage: avg,
          studentCount: report.students.length,
        });
      }
      return {
        data: new AcademicComparisonDto({
          type: 'class',
          academicYearId: yearId,
          items,
        }),
      };
    }

    if (subjectIds && subjectIds.length > 0) {
      const filtered = subjectIds.filter((id) => allowedSubjects.includes(id));
      for (const subId of filtered) {
        const { data: subRow } = await supabase
          .from('subjects')
          .select('id, name')
          .eq('id', subId)
          .maybeSingle();
        const name = (subRow as { name?: string } | null)?.name ?? 'Unknown';
        const { data: report } = await this.getAcademicReportBySubject(subId, branchId, yearId, userId, userRoles);
        const avg =
          report.byClass.length > 0
            ? Math.round(
                report.byClass.reduce((s, c) => s + c.averagePercentage, 0) / report.byClass.length,
              )
            : 0;
        const totalStudents = report.byClass.reduce((s, c) => s + c.studentCount, 0);
        items.push({
          id: subId,
          name,
          averagePercentage: avg,
          studentCount: totalStudents,
        });
      }
      return {
        data: new AcademicComparisonDto({
          type: 'subject',
          academicYearId: yearId,
          items,
        }),
      };
    }

    return {
      data: new AcademicComparisonDto({
        type: 'class',
        academicYearId: yearId,
        items: [],
      }),
    };
  }

  async exportAcademicReportPdf(
    branchId: string,
    academicYearId: string | undefined,
    classSectionId: string | undefined,
    subjectId: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
    filter?: ExportFilterQuery,
  ): Promise<Buffer> {
    if (classSectionId) {
      const { data: report } = await this.getAcademicReportByClass(
        classSectionId,
        branchId,
        academicYearId,
        userId,
        userRoles,
      );
      const shouldInclude = buildInclusionChecker(['attendance', 'average'] as const, filter);
      let htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:8px;text-align:left;}
th{background:#eee;}
</style></head>
<body>
<h2>Academic Report - ${this.escapeHtml(report.className)} ${this.escapeHtml(report.sectionName)}</h2>
<table>
<tr>
  <th>Student</th>
  ${shouldInclude('attendance') ? '<th>Attendance %</th>' : ''}
  ${shouldInclude('average') ? '<th>Average %</th>' : ''}
</tr>
`;
      report.students.forEach((s) => {
        htmlContent += `<tr>
<td>${this.escapeHtml(s.studentName)}</td>
${shouldInclude('attendance') ? `<td>${s.attendancePercentage}%</td>` : ''}
${shouldInclude('average') ? `<td>${s.averagePercentage ?? '-'}%</td>` : ''}
</tr>
`;
      });
      htmlContent += `</table></body></html>`;
      const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
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
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate,
          margin: { top: '85px', right: '20px', bottom: '55px', left: '20px' },
          printBackground: true,
        });
        return Buffer.from(pdf);
      } finally {
        await browser.close();
      }
    }
    if (subjectId) {
      const { data: report } = await this.getAcademicReportBySubject(
        subjectId,
        branchId,
        academicYearId,
        userId,
        userRoles,
      );
      const shouldInclude = buildInclusionChecker(['average', 'students'] as const, filter);
      let htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
table{border-collapse:collapse;width:100%;} th,td{border:1px solid #333;padding:8px;text-align:left;}
th{background:#eee;}
</style></head>
<body>
<h2>Subject Report - ${this.escapeHtml(report.subjectName)}</h2>
<table>
<tr>
  <th>Class</th>
  <th>Section</th>
  ${shouldInclude('average') ? '<th>Avg %</th>' : ''}
  ${shouldInclude('students') ? '<th>Students</th>' : ''}
</tr>
`;
      report.byClass.forEach((c) => {
        htmlContent += `<tr>
<td>${this.escapeHtml(c.className)}</td>
<td>${this.escapeHtml(c.sectionName)}</td>
${shouldInclude('average') ? `<td>${c.averagePercentage}%</td>` : ''}
${shouldInclude('students') ? `<td>${c.studentCount}</td>` : ''}
</tr>
`;
      });
      htmlContent += `</table></body></html>`;
      const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
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
          displayHeaderFooter: true,
          headerTemplate,
          footerTemplate,
          margin: { top: '85px', right: '20px', bottom: '55px', left: '20px' },
          printBackground: true,
        });
        return Buffer.from(pdf);
      } finally {
        await browser.close();
      }
    }
    throw new BadRequestException('Provide classSectionId or subjectId for academic export');
  }

  async exportAcademicReportExcel(
    branchId: string,
    academicYearId: string | undefined,
    classSectionId: string | undefined,
    subjectId: string | undefined,
    userId: string,
    userRoles: string[] | undefined,
  ): Promise<Buffer> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';

    if (classSectionId) {
      const { data: report } = await this.getAcademicReportByClass(
        classSectionId,
        branchId,
        academicYearId,
        userId,
        userRoles,
      );
      const ws = workbook.addWorksheet('Academic - Class');
      ws.columns = [
        { header: 'Student', key: 'name', width: 28 },
        { header: 'Attendance %', key: 'attPct', width: 14 },
        { header: 'Average %', key: 'avgPct', width: 12 },
      ];
      report.students.forEach((s) => {
        ws.addRow({
          name: s.studentName,
          attPct: `${s.attendancePercentage}%`,
          avgPct: s.averagePercentage != null ? `${s.averagePercentage}%` : '',
        });
      });
      return (await workbook.xlsx.writeBuffer()) as Buffer;
    }

    if (subjectId) {
      const { data: report } = await this.getAcademicReportBySubject(
        subjectId,
        branchId,
        academicYearId,
        userId,
        userRoles,
      );
      const ws = workbook.addWorksheet('Academic - Subject');
      ws.columns = [
        { header: 'Class', key: 'className', width: 20 },
        { header: 'Section', key: 'sectionName', width: 12 },
        { header: 'Avg %', key: 'avg', width: 10 },
        { header: 'Students', key: 'count', width: 10 },
      ];
      report.byClass.forEach((c) => {
        ws.addRow({
          className: c.className,
          sectionName: c.sectionName,
          avg: `${c.averagePercentage}%`,
          count: c.studentCount,
        });
      });
      return (await workbook.xlsx.writeBuffer()) as Buffer;
    }

    throw new BadRequestException('Provide classSectionId or subjectId for academic export');
  }

  async getClassReport(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
    userId?: string,
    userRoles?: string[],
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

    const { data: enrolments } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('status', 'active');
    const studentIds = (enrolments || []).map((r: { student_id: string }) => r.student_id);
    const { data: studentRows } =
      studentIds.length > 0
        ? await supabase
            .from('students')
            .select('id, user_id')
            .in('id', studentIds)
            .eq('branch_id', branchId)
            .eq('is_active', true)
        : { data: [] };
    const students = (studentRows || []) as { id: string; user_id: string | null }[];
    const userIds = students.map((s) => s.user_id).filter(Boolean) as string[];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
    );

    const [summaryMap, gradesMap, assignmentStatsMap] = await Promise.all([
      this.attendanceService.getAttendanceSummariesByStudents(
        studentIds,
        branchId,
        yearId,
      ),
      this.getAveragePercentagesForStudents(studentIds, branchId),
      this.getAssignmentStatisticsForStudents(studentIds, classSectionId, branchId, yearId),
    ]);

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
        averagePercentage: gradesMap.get(s.id),
        assignmentStatistics: assignmentStatsMap.get(s.id),
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

  /**
   * Calculate average percentage across all subjects for multiple students.
   */
  private async getAveragePercentagesForStudents(
    studentIds: string[],
    branchId: string,
  ): Promise<Map<string, number>> {
    const supabase = this.supabaseConfig.getClient();
    const result = new Map<string, number>();

    if (studentIds.length === 0) return result;

    // Get all grades for these students
    const { data: grades } = await supabase
      .from('student_grades')
      .select('student_id, marks_obtained, assessment_id')
      .in('student_id', studentIds)
      .eq('branch_id', branchId);

    if (!grades || grades.length === 0) return result;

    // Get assessment totals
    const assessmentIds = [...new Set(grades.map((g: { assessment_id: string }) => g.assessment_id))];
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, total_marks')
      .in('id', assessmentIds);

    const assessmentTotalMap = new Map(
      (assessments || []).map((a: { id: string; total_marks: number }) => [
        a.id,
        a.total_marks || 1,
      ]),
    );

    // Calculate percentages per student
    const studentPercentages = new Map<string, number[]>();
    for (const g of grades) {
      const grade = g as { student_id: string; marks_obtained: number; assessment_id: string };
      const total = assessmentTotalMap.get(grade.assessment_id) || 1;
      const percentage = Math.round((Number(grade.marks_obtained) / total) * 100);
      const list = studentPercentages.get(grade.student_id) || [];
      list.push(percentage);
      studentPercentages.set(grade.student_id, list);
    }

    // Calculate averages
    studentPercentages.forEach((pcts, studentId) => {
      if (pcts.length > 0) {
        const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
        result.set(studentId, avg);
      }
    });

    return result;
  }

  /**
   * Calculate assignment statistics for multiple students.
   */
  private async getAssignmentStatisticsForStudents(
    studentIds: string[],
    classSectionId: string,
    branchId: string,
    academicYearId: string,
  ): Promise<Map<string, AssignmentStatisticsDto>> {
    const supabase = this.supabaseConfig.getClient();
    const result = new Map<string, AssignmentStatisticsDto>();

    if (studentIds.length === 0) return result;

    // Get all assessments for this class section
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('is_published', true);

    if (!assessments || assessments.length === 0) {
      // Return empty stats for all students
      studentIds.forEach((id) => {
        result.set(
          id,
          new AssignmentStatisticsDto({
            totalAssignments: 0,
            viewedAssignments: 0,
            notViewedAssignments: 0,
            submittedAssignments: 0,
            inProgressAssignments: 0,
            notStartedAssignments: 0,
            viewingRate: 0,
            submissionRate: 0,
          }),
        );
      });
      return result;
    }

    const assessmentIds = assessments.map((a: { id: string }) => a.id);
    const totalAssignments = assessmentIds.length;

    // Get statuses for all students and assessments
    const { data: statuses } = await supabase
      .from('student_assessment_statuses')
      .select('student_id, assessment_id, status, is_read')
      .in('student_id', studentIds)
      .in('assessment_id', assessmentIds);

    // Build status map: studentId -> assessmentId -> { status, isRead }
    const statusMap = new Map<string, Map<string, { status: string; isRead: boolean }>>();
    studentIds.forEach((id) => {
      statusMap.set(id, new Map());
    });

    (statuses || []).forEach((s: {
      student_id: string;
      assessment_id: string;
      status: string;
      is_read: boolean;
    }) => {
      const studentMap = statusMap.get(s.student_id);
      if (studentMap) {
        studentMap.set(s.assessment_id, {
          status: s.status || 'not_started',
          isRead: s.is_read || false,
        });
      }
    });

    // Calculate statistics per student
    studentIds.forEach((studentId) => {
      const studentStatusMap = statusMap.get(studentId) || new Map();
      let viewedAssignments = 0;
      let submittedAssignments = 0;
      let inProgressAssignments = 0;
      let notStartedAssignments = 0;

      assessmentIds.forEach((assessmentId) => {
        const status = studentStatusMap.get(assessmentId);
        if (status?.isRead) {
          viewedAssignments++;
        }
        if (status?.status === 'submitted') {
          submittedAssignments++;
        } else if (status?.status === 'in_progress') {
          inProgressAssignments++;
        } else {
          notStartedAssignments++;
        }
      });

      const notViewedAssignments = totalAssignments - viewedAssignments;
      const viewingRate = totalAssignments > 0 ? Math.round((viewedAssignments / totalAssignments) * 100) : 0;
      const submissionRate = totalAssignments > 0 ? Math.round((submittedAssignments / totalAssignments) * 100) : 0;

      result.set(
        studentId,
        new AssignmentStatisticsDto({
          totalAssignments,
          viewedAssignments,
          notViewedAssignments,
          submittedAssignments,
          inProgressAssignments,
          notStartedAssignments,
          viewingRate,
          submissionRate,
        }),
      );
    });

    return result;
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

    const { data: enrolments } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('status', 'active');
    const studentIds = (enrolments || []).map((r: { student_id: string }) => r.student_id);

    const { data: students } =
      studentIds.length > 0
        ? await supabase
            .from('students')
            .select('id, user_id')
            .in('id', studentIds)
            .eq('branch_id', branchId)
            .eq('is_active', true)
        : { data: [] };
    const userIds = (students || []).map((s: { user_id: string | null }) => s.user_id).filter(Boolean) as string[];

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
    filter?: ExportFilterQuery,
  ): Promise<Buffer> {
    const { data: report } = await this.getStudentReport(studentId, branchId, academicYearId);
    const shouldInclude = buildInclusionChecker(
      ['academic', 'attendance', 'behavioral', 'assignmentStatistics', 'assignmentEngagement'] as const,
      filter,
    );

    // Helper function to render star rating
    const renderStars = (value: number): string => {
      const fullStars = Math.floor(value);
      const hasHalfStar = value % 1 >= 0.5;
      let stars = '★'.repeat(fullStars);
      if (hasHalfStar) stars += '☆';
      return stars || '—';
    };

    // Helper function to get status badge HTML
    const getStatusBadge = (status: string, isViewed: boolean): string => {
      let color = 'gray';
      let text = 'Not Started';
      if (status === 'submitted') {
        color = 'green';
        text = 'Submitted';
      } else if (status === 'in_progress') {
        color = 'yellow';
        text = 'In Progress';
      } else if (isViewed) {
        color = 'blue';
        text = 'Viewed';
      }
      return `<span class="badge badge-${color}">${text}</span>`;
    };

    // Helper function to get engagement color
    const getEngagementColor = (score: number): string => {
      if (score >= 70) return 'green';
      if (score >= 40) return 'yellow';
      return 'red';
    };

    // Helper function to get days until due color
    const getDaysColor = (days?: number): string => {
      if (days === undefined) return 'gray';
      if (days < 0) return 'red';
      if (days <= 3) return 'yellow';
      return 'green';
    };

    // Build HTML content
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #212529;
      background: #fff;
      padding: 20px;
    }
    .header {
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #212529;
    }
    .header .subtitle {
      font-size: 14px;
      color: #868e96;
    }
    .section {
      background: #fff;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 16px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #212529;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #dee2e6;
    }
    table th {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
    }
    table td {
      border: 1px solid #dee2e6;
      padding: 12px;
      font-size: 13px;
    }
    table tr:not(:last-child) td {
      border-bottom: 1px solid #dee2e6;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-green {
      background: #d4edda;
      color: #155724;
    }
    .badge-yellow {
      background: #fff3cd;
      color: #856404;
    }
    .badge-blue {
      background: #cfe2ff;
      color: #084298;
    }
    .badge-gray {
      background: #e9ecef;
      color: #495057;
    }
    .badge-red {
      background: #f8d7da;
      color: #721c24;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      text-align: center;
      padding: 16px;
    }
    .stat-label {
      font-size: 12px;
      color: #868e96;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
    }
    .stat-value.blue { color: #228be6; }
    .stat-value.red { color: #fa5252; }
    .stat-value.green { color: #51cf66; }
    .stat-value.yellow { color: #ffd43b; }
    .stat-value.gray { color: #868e96; }
    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
    }
    .progress-fill.green { background: #51cf66; }
    .progress-fill.yellow { background: #ffd43b; }
    .progress-fill.red { background: #fa5252; }
    .attendance-group {
      display: flex;
      gap: 24px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .attendance-item {
      font-size: 14px;
    }
    .attendance-item strong {
      font-weight: 600;
    }
    .stars {
      font-size: 16px;
      color: #ffd43b;
      letter-spacing: 2px;
    }
    .ring-progress-container {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 20px;
    }
    .ring-progress {
      width: 120px;
      height: 120px;
      position: relative;
    }
    .ring-progress svg {
      transform: rotate(-90deg);
    }
    .ring-progress-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14px;
      font-weight: 700;
    }
    .ring-progress-label {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .ring-progress-desc {
      font-size: 12px;
      color: #868e96;
    }
    @media print {
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.escapeHtml(report.studentName)}</h1>
    <div class="subtitle">${this.escapeHtml(report.academicYearName)}</div>
  </div>
`;

    // Academic Section
    if (shouldInclude('academic') && report.academic?.entries?.length) {
      htmlContent += `
  <div class="section">
    <div class="section-title">Academic</div>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Assessment</th>
          <th>Marks</th>
          <th>Grade</th>
          <th>Rank / Percentile</th>
        </tr>
      </thead>
      <tbody>
`;
      report.academic.entries.forEach((e) => {
        const rankText = e.rank ? `Rank ${e.rank}` : e.percentile ? `Top ${e.percentile}%` : '—';
        htmlContent += `
        <tr>
          <td>${this.escapeHtml(e.subjectName)}</td>
          <td>${this.escapeHtml(e.assessmentTitle)}</td>
          <td>${e.marksObtained} / ${e.totalMarks} (${e.percentage}%)</td>
          <td>${e.letterGrade ?? '—'}</td>
          <td>${rankText}</td>
        </tr>
`;
      });
      htmlContent += `
      </tbody>
    </table>
  </div>
`;
    }

    // Attendance Section
    if (shouldInclude('attendance') && report.attendance) {
      htmlContent += `
  <div class="section">
    <div class="section-title">Attendance</div>
    <div class="attendance-group">
      <div class="attendance-item">Present: <strong>${report.attendance.presentDays}</strong></div>
      <div class="attendance-item">Absent: <strong>${report.attendance.absentDays}</strong></div>
      <div class="attendance-item">Late: <strong>${report.attendance.lateDays}</strong></div>
      <div class="attendance-item">Excused: <strong>${report.attendance.excusedDays}</strong></div>
    </div>
    <div class="attendance-item">
      Total days: ${report.attendance.totalDays} · Attendance: <strong>${report.attendance.percentage}%</strong>
    </div>
  </div>
`;
    }

    // Behavioral Section
    if (shouldInclude('behavioral') && report.behavioral?.periods?.length) {
      const allAttributes = Array.from(
        new Set(report.behavioral.periods.flatMap((p) => p.attributes.map((a) => a.attributeName))),
      ).sort();

      htmlContent += `
  <div class="section">
    <div class="section-title">Behavioral</div>
    <table>
      <thead>
        <tr>
          <th>Period</th>
`;
      allAttributes.forEach((attr) => {
        htmlContent += `          <th>${this.escapeHtml(attr)}</th>\n`;
      });
      htmlContent += `
        </tr>
      </thead>
      <tbody>
`;
      report.behavioral.periods.forEach((p) => {
        const attrMap = Object.fromEntries(p.attributes.map((a) => [a.attributeName, a.average]));
        htmlContent += `
        <tr>
          <td>${this.escapeHtml(p.period)}</td>
`;
        allAttributes.forEach((attr) => {
          const value = attrMap[attr];
          htmlContent += `          <td>${value != null ? `<span class="stars">${renderStars(value)} ${value.toFixed(1)}</span>` : '—'}</td>\n`;
        });
        htmlContent += `
        </tr>
`;
      });
      htmlContent += `
      </tbody>
    </table>
  </div>
`;
    }

    // Assignment Statistics Section
    if (shouldInclude('assignmentStatistics') && report.assignmentStatistics) {
      const stats = report.assignmentStatistics;
      htmlContent += `
  <div class="section">
    <div class="section-title">Assignment Statistics</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Assignments</div>
        <div class="stat-value">${stats.totalAssignments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Viewed</div>
        <div class="stat-value blue">${stats.viewedAssignments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Not Viewed</div>
        <div class="stat-value red">${stats.notViewedAssignments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Submitted</div>
        <div class="stat-value green">${stats.submittedAssignments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">In Progress</div>
        <div class="stat-value yellow">${stats.inProgressAssignments}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Not Started</div>
        <div class="stat-value gray">${stats.notStartedAssignments}</div>
      </div>
    </div>
    <div class="ring-progress-container">
      <div class="ring-progress">
        <svg width="120" height="120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e9ecef" stroke-width="12"/>
          <circle cx="60" cy="60" r="54" fill="none" stroke="#228be6" stroke-width="12"
            stroke-dasharray="${(stats.viewingRate / 100) * 339.292} 339.292"
            stroke-dashoffset="0" stroke-linecap="round"/>
        </svg>
        <div class="ring-progress-text" style="color: #228be6;">${stats.viewingRate}%</div>
      </div>
      <div>
        <div class="ring-progress-label">Viewing Rate</div>
        <div class="ring-progress-desc">${stats.viewedAssignments} of ${stats.totalAssignments} assignments viewed</div>
      </div>
    </div>
    <div class="ring-progress-container">
      <div class="ring-progress">
        <svg width="120" height="120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e9ecef" stroke-width="12"/>
          <circle cx="60" cy="60" r="54" fill="none" stroke="#51cf66" stroke-width="12"
            stroke-dasharray="${(stats.submissionRate / 100) * 339.292} 339.292"
            stroke-dashoffset="0" stroke-linecap="round"/>
        </svg>
        <div class="ring-progress-text" style="color: #51cf66;">${stats.submissionRate}%</div>
      </div>
      <div>
        <div class="ring-progress-label">Submission Rate</div>
        <div class="ring-progress-desc">${stats.submittedAssignments} of ${stats.totalAssignments} assignments submitted</div>
      </div>
    </div>
  </div>
`;
    }

    // Assignment Engagement Section
    if (shouldInclude('assignmentEngagement') && report.assignmentEngagement && report.assignmentEngagement.length > 0) {
      htmlContent += `
  <div class="section">
    <div class="section-title">Assignment Engagement</div>
    <table>
      <thead>
        <tr>
          <th>Assignment</th>
          <th>Subject</th>
          <th>Due Date</th>
          <th>Status</th>
          <th>Engagement</th>
          <th>Days Until Due</th>
        </tr>
      </thead>
      <tbody>
`;
      report.assignmentEngagement.forEach((a) => {
        const dueDateText = a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—';
        const dueText = a.daysUntilDue !== undefined
          ? (a.daysUntilDue < 0 ? `${Math.abs(a.daysUntilDue)} days overdue` : `${a.daysUntilDue} days left`)
          : '—';
        const engagementColor = getEngagementColor(a.engagementScore);
        const daysColor = getDaysColor(a.daysUntilDue);
        htmlContent += `
        <tr>
          <td>${this.escapeHtml(a.assignmentTitle)}</td>
          <td>${this.escapeHtml(a.subjectName)}</td>
          <td>${dueDateText}</td>
          <td>${getStatusBadge(a.status, a.isViewed)}</td>
          <td>
            <div class="progress-bar">
              <div class="progress-fill ${engagementColor}" style="width: ${a.engagementScore}%"></div>
            </div>
            <div style="font-size: 12px; color: #868e96;">${a.engagementScore}%</div>
          </td>
          <td style="color: ${daysColor};">${dueText}</td>
        </tr>
`;
      });
      htmlContent += `
      </tbody>
    </table>
  </div>
`;
    }

    htmlContent += `
</body>
</html>
`;

    // Generate PDF using Puppeteer
    const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
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
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: { top: '85px', right: '20px', bottom: '55px', left: '20px' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  async exportStudentReportExcel(
    studentId: string,
    branchId: string,
    academicYearId?: string,
    filter?: ExportFilterQuery,
  ): Promise<Buffer> {
    const { data: report } = await this.getStudentReport(studentId, branchId, academicYearId);
    const shouldInclude = buildInclusionChecker(
      ['academic', 'attendance', 'behavioral'] as const,
      filter,
    );
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NTG SMS';

    if (shouldInclude('academic') && report.academic?.entries?.length) {
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
    if (shouldInclude('attendance') && report.attendance) {
      const ws = workbook.addWorksheet('Attendance');
      ws.addRow(['Metric', 'Value']);
      ws.addRow(['Present', report.attendance.presentDays]);
      ws.addRow(['Absent', report.attendance.absentDays]);
      ws.addRow(['Late', report.attendance.lateDays]);
      ws.addRow(['Excused', report.attendance.excusedDays]);
      ws.addRow(['Total days', report.attendance.totalDays]);
      ws.addRow(['Percentage', `${report.attendance.percentage}%`]);
    }
    if (shouldInclude('behavioral') && report.behavioral?.periods?.length) {
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

  /**
   * Get student counts (total, male, female) for a specific class section.
   */
  async getClassStudentCounts(
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: ClassStudentCountDto }> {
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

    const { data: enrolments } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', c.class_id)
      .eq('section_id', c.section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('status', 'active');
    const studentIds = (enrolments || []).map((r: { student_id: string }) => r.student_id);

    const { data: students } =
      studentIds.length > 0
        ? await supabase
            .from('students')
            .select('id, user_id')
            .in('id', studentIds)
            .eq('branch_id', branchId)
            .eq('is_active', true)
        : { data: [] };

    const studentList = (students || []) as { id: string; user_id: string | null }[];
    const userIds = studentList.map((s) => s.user_id).filter(Boolean) as string[];
    let maleCount = 0;
    let femaleCount = 0;
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, gender')
        .in('id', userIds);
      const profileGenderMap = new Map(
        (profiles || []).map((p: { id: string; gender: string | null }) => [p.id, p.gender]),
      );
      studentList.forEach((s) => {
        const g = s.user_id ? profileGenderMap.get(s.user_id) : null;
        if (g === 'male') maleCount++;
        else if (g === 'female') femaleCount++;
      });
    }
    const totalStudents = studentList.length;

    return {
      data: new ClassStudentCountDto({
        classSectionId,
        className,
        sectionName,
        totalStudents,
        maleCount,
        femaleCount,
      }),
    };
  }

  /**
   * Get student counts for all class sections in a branch (public endpoint).
   */
  async getAllClassStudentCounts(
    branchId: string,
    academicYearId?: string,
  ): Promise<{ data: ClassStudentCountDto[] }> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;

    // Get all class sections
    const { data: classSections } = await supabase
      .from('class_sections')
      .select('id, class_id, section_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId);

    if (!classSections || classSections.length === 0) {
      return { data: [] };
    }

    const classIds = [...new Set(classSections.map((cs) => cs.class_id))];
    const sectionIds = [...new Set(classSections.map((cs) => cs.section_id))];

    const [classesData, sectionsData] = await Promise.all([
      supabase.from('classes').select('id, display_name').in('id', classIds),
      supabase.from('sections').select('id, name').in('id', sectionIds),
    ]);

    const classMap = new Map(
      (classesData.data || []).map((c: { id: string; display_name: string }) => [c.id, c.display_name]),
    );
    const sectionMap = new Map(
      (sectionsData.data || []).map((s: { id: string; name: string }) => [s.id, s.name]),
    );

    // Get all students (gender is on profiles, not students)
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, class_id, section_id, user_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('is_active', true)
      .in('class_id', classIds)
      .in('section_id', sectionIds);

    const studentList = (allStudents || []) as {
      id: string;
      class_id: string;
      section_id: string;
      user_id: string | null;
    }[];

    // Fetch gender from profiles
    const userIds = [...new Set(studentList.map((s) => s.user_id).filter(Boolean))] as string[];
    let profileGenderMap = new Map<string, string | null>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, gender')
        .in('id', userIds);
      profileGenderMap = new Map(
        (profiles || []).map((p: { id: string; gender: string | null }) => [p.id, p.gender]),
      );
    }

    // Group students by class_section_id with gender from profile
    const studentsBySection = new Map<string, { gender: string | null }[]>();
    for (const student of studentList) {
      const cs = classSections.find(
        (c) => c.class_id === student.class_id && c.section_id === student.section_id,
      );
      if (cs) {
        const gender = student.user_id ? profileGenderMap.get(student.user_id) ?? null : null;
        const list = studentsBySection.get(cs.id) || [];
        list.push({ gender });
        studentsBySection.set(cs.id, list);
      }
    }

    const counts: ClassStudentCountDto[] = classSections.map((cs) => {
      const students = studentsBySection.get(cs.id) || [];
      const totalStudents = students.length;
      const maleCount = students.filter((s) => s.gender === 'male').length;
      const femaleCount = students.filter((s) => s.gender === 'female').length;

      return new ClassStudentCountDto({
        classSectionId: cs.id,
        className: classMap.get(cs.class_id) ?? 'Unknown',
        sectionName: sectionMap.get(cs.section_id) ?? 'Unknown',
        totalStudents,
        maleCount,
        femaleCount,
      });
    });

    // Sort by class name alphabetically, then by section name
    counts.sort((a, b) => {
      const classCompare = (a.className || '').localeCompare(b.className || '', undefined, { sensitivity: 'base' });
      if (classCompare !== 0) return classCompare;
      return (a.sectionName || '').localeCompare(b.sectionName || '', undefined, { sensitivity: 'base' });
    });

    return { data: counts };
  }
}
