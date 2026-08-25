import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import archiver from 'archiver';
import puppeteer, { type Browser } from 'puppeteer';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { PdfLogoCacheService } from '../../common/pdf/pdf-logo-cache.service';
import { buildPdfFooterTemplate, buildPdfHeaderTemplate } from '../../common/pdf/pdf-templates';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { AttendanceService } from '../attendance/attendance.service';
import { BehavioralService } from '../behavioral/behavioral.service';
import { BehavioralFrameworkService } from '../behavioral-framework/behavioral-framework.service';
import { StudentResultDto } from './dto/student-result.dto';
import { ResultSubjectDto } from './dto/result-subject.dto';
import { ClassSectionResultsDto } from './dto/class-section-results.dto';
import { ResultCardDto } from './dto/result-card.dto';
import { DetailedStudentResultDto } from './dto/detailed-student-result.dto';
import { AssessmentWiseEntryDto } from './dto/assessment-wise-entry.dto';
import type { ResultType } from './dto/result-type.enum';
import type { ReportKind } from './dto/report-kind.enum';
import { ResultReportSettingsService } from './result-report-settings.service';
import {
  buildDetailedMinimalPageInner,
  buildMinimalProgressInner,
  buildMinimalTermAnnualReportInner,
  buildModernDetailedPageInner,
  buildModernProgressInner,
  buildModernTermAnnualReportInner,
  composeDesignPdfHtml,
  composeDesignPdfHtmlMultiCard,
  readDesignTemplateStyleBlock,
} from './result-report-pdf-html';
import { buildPdfThemeVariablesCss } from './pdf-theme';

type GradeRangeRow = { letter: string; min_percentage: number; max_percentage: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

type BehavioralPeriod = { period: string; attributes: { attributeName: string; average: number }[] };

/** Optional filters when loading assessments for results / readiness / progress months. */
export type AssessmentScopeOptions = {
  /** Only term-examination types matching mid_term / final (marks readiness). */
  phaseExamsOnly?: boolean;
  /** Calendar month 1–12 for progress (monthly) reports. */
  progressMonth?: number;
  /**
   * Term window for detailed Mid / Final PDFs:
   * - until_mid: assessments on/before mid-exam cutoff (excludes final exams when no cutoff)
   * - after_mid: assessments after mid-exam cutoff (or final exams only when no cutoff)
   */
  termWindow?: 'until_mid' | 'after_mid';
};

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
    private readonly attendanceService: AttendanceService,
    private readonly behavioralService: BehavioralService,
    private readonly behavioralFrameworkService: BehavioralFrameworkService,
    private readonly pdfLogoCache: PdfLogoCacheService,
    private readonly resultReportSettingsService: ResultReportSettingsService,
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

  /** School / branch lines for report card HTML (matches PDF header branding). */
  private async getReportSchoolLines(branchId: string): Promise<{ line1: string; line2: string }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch } = await supabase
      .from('branches')
      .select('name, name_translations, tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    const branchRow = branch as {
      name: string;
      name_translations?: Record<string, string> | null;
      tenant_id: string | null;
    } | null;
    if (!branchRow) return { line1: 'School', line2: '' };
    const branchName = this.resolveBranchName(branchRow, 'en');
    const tenantId = branchRow.tenant_id;
    if (!tenantId) return { line1: branchName, line2: '' };
    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    const tenantName = (tenant as { name?: string } | null)?.name?.trim();
    if (tenantName) return { line1: `${tenantName} — ${branchName}`, line2: '' };
    return { line1: branchName, line2: '' };
  }

  /** Tenant theme primary for PDF accent (`#RRGGBB`), from system_settings. */
  private async getTenantPdfPrimaryHex(branchId: string): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch } = await supabase.from('branches').select('tenant_id').eq('id', branchId).maybeSingle();
    const tenantId = (branch as { tenant_id: string | null } | null)?.tenant_id;
    if (!tenantId) return null;
    const key = `tenant_theme_primary_color:${tenantId}`;
    const { data: row } = await supabase.from('system_settings').select('value').eq('key', key).maybeSingle();
    const v = (row as { value?: unknown } | null)?.value;
    return typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v.trim()) ? v.trim() : null;
  }

  /**
   * Design templates include school branding; do not add Puppeteer header/footer.
   * Pass an existing `browser` for bulk ZIP (one Chromium for many PDFs).
   */
  private async printResultCardHtmlToPdf(html: string, browser?: Browser): Promise<Buffer> {
    const ownsBrowser = !browser;
    const active =
      browser ??
      (await puppeteer.launch({
        headless: true,
        executablePath: getPuppeteerExecutablePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      }));
    try {
      const page = await active.newPage();
      try {
        page.setDefaultNavigationTimeout(0);
        await page.emulateMediaType('print');
        await page.setContent(html, { waitUntil: 'load', timeout: 0 });
        const pdf = await page.pdf({
          format: 'A4',
          displayHeaderFooter: false,
          margin: { top: '14px', right: '14px', bottom: '14px', left: '14px' },
          printBackground: true,
        });
        return Buffer.from(pdf);
      } finally {
        await page.close().catch(() => undefined);
      }
    } finally {
      if (ownsBrowser) await active.close();
    }
  }

  /** 1-based ranks by overall percentage (desc). Same ordering as previous getClassRank. */
  private ranksFromClassBatch(students: StudentResultDto[]): Map<string, number> {
    const sorted = [...students].sort(
      (a, b) => (b.overallPercentage ?? 0) - (a.overallPercentage ?? 0),
    );
    const ranks = new Map<string, number>();
    sorted.forEach((s, idx) => ranks.set(s.studentId, idx + 1));
    return ranks;
  }

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

  /** Classify a term-examination assessment type name as mid_term or final. */
  private classifyTermExamPhase(typeName: string): 'mid_term' | 'final' | null {
    const n = typeName.toLowerCase();
    if (n.includes('mid')) return 'mid_term';
    if (n.includes('final')) return 'final';
    return null;
  }

  private assessmentFallsInCalendarMonth(
    dueDate: string | null | undefined,
    createdAt: string | null | undefined,
    month: number,
  ): boolean {
    const raw = dueDate || createdAt;
    if (!raw) return false;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return false;
    return d.getMonth() + 1 === month;
  }

  private assessmentSortDateMs(
    dueDate: string | null | undefined,
    createdAt: string | null | undefined,
  ): number | null {
    const raw = dueDate || createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
  }

  private msToIsoDate(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
  }

  private addOneCalendarDay(isoDate: string): string {
    const d = new Date(`${isoDate}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  private calendarMonthRangeWithinYear(
    yearStart: string,
    yearEnd: string,
    month: number,
  ): { startDate: string; endDate: string } {
    const startY = Number(yearStart.slice(0, 4));
    const endY = Number(yearEnd.slice(0, 4));
    const mm = String(month).padStart(2, '0');
    for (let y = startY; y <= endY + 1; y++) {
      const first = `${y}-${mm}-01`;
      const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
      const last = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`;
      if (last < yearStart) continue;
      if (first > yearEnd) continue;
      const startDate = first < yearStart ? yearStart : first;
      const endDate = last > yearEnd ? yearEnd : last;
      if (startDate <= endDate) return { startDate, endDate };
    }
    const y = startY;
    const first = `${y}-${mm}-01`;
    const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
    return { startDate: first, endDate: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
  }

  /**
   * Mid-exam cutoff date (YYYY-MM-DD) for a class section, or null if no mid exams dated.
   */
  private async getMidCutoffIsoDate(
    classSectionId: string,
    branchId: string,
    academicYearId: string,
  ): Promise<string | null> {
    const supabase = this.supabaseConfig.getClient();
    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('due_date, created_at, assessment_type_id')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    throwIfDbError(error);
    const list = (assessments || []) as Array<{
      due_date?: string | null;
      created_at?: string | null;
      assessment_type_id: string;
    }>;
    if (list.length === 0) return null;
    const typeIds = [...new Set(list.map((a) => a.assessment_type_id).filter(Boolean))];
    if (typeIds.length === 0) return null;
    const { data: types, error: typeErr } = await supabase
      .from('assessment_types')
      .select('id, name, is_term_examination')
      .in('id', typeIds)
      .eq('branch_id', branchId);
    throwIfDbError(typeErr);
    const midTypeIds = new Set<string>();
    for (const t of types || []) {
      const row = t as { id: string; name: string; is_term_examination: boolean };
      if (!row.is_term_examination) continue;
      if (this.classifyTermExamPhase(row.name) === 'mid_term') midTypeIds.add(row.id);
    }
    let midCutoffMs: number | null = null;
    for (const a of list) {
      if (!midTypeIds.has(a.assessment_type_id)) continue;
      const ms = this.assessmentSortDateMs(a.due_date, a.created_at);
      if (ms == null) continue;
      if (midCutoffMs == null || ms > midCutoffMs) midCutoffMs = ms;
    }
    return midCutoffMs != null ? this.msToIsoDate(midCutoffMs) : null;
  }

  /**
   * Date window for Conduct + attendance summary on term / progress PDFs.
   */
  private async resolveSummaryDateRange(params: {
    classSectionId: string;
    branchId: string;
    academicYearId: string;
    reportKind: ReportKind;
    resultType: ResultType;
    progressMonth?: number;
    termWindow?: 'until_mid' | 'after_mid';
  }): Promise<{ startDate: string; endDate: string }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: yearRow, error } = await supabase
      .from('academic_years')
      .select('start_date, end_date')
      .eq('id', params.academicYearId)
      .maybeSingle();
    throwIfDbError(error);
    const startDate = (yearRow as { start_date?: string } | null)?.start_date;
    const endDate = (yearRow as { end_date?: string } | null)?.end_date;
    if (!startDate || !endDate) {
      throw new BadRequestException('Academic year dates are not configured');
    }
    const today = new Date().toISOString().slice(0, 10);
    const todayClamped = today < endDate ? today : endDate;

    if (
      params.reportKind === 'progress_report' &&
      params.progressMonth != null &&
      params.progressMonth >= 1 &&
      params.progressMonth <= 12
    ) {
      return this.calendarMonthRangeWithinYear(startDate, endDate, params.progressMonth);
    }

    const window =
      params.termWindow ??
      (params.reportKind === 'term_report' &&
      (params.resultType === 'mid_term' || params.resultType === 'interim')
        ? 'until_mid'
        : params.reportKind === 'term_report' && params.resultType === 'final'
          ? 'after_mid'
          : undefined);

    if (window === 'until_mid' || window === 'after_mid') {
      const midCutoff = await this.getMidCutoffIsoDate(
        params.classSectionId,
        params.branchId,
        params.academicYearId,
      );
      if (window === 'until_mid') {
        return {
          startDate,
          endDate: midCutoff ?? todayClamped,
        };
      }
      if (midCutoff) {
        const after = this.addOneCalendarDay(midCutoff);
        return {
          startDate: after <= endDate ? after : endDate,
          endDate,
        };
      }
      return { startDate, endDate };
    }

    return { startDate, endDate: todayClamped };
  }

  private async resolveConductLabel(
    studentId: string,
    branchId: string,
    academicYearId: string,
    startDate: string,
    endDate: string,
  ): Promise<string> {
    const startYm = startDate.slice(0, 7);
    const endYm = endDate.slice(0, 7);

    try {
      const cfg = await this.behavioralFrameworkService.getConfig(branchId);
      if (cfg.data.activeSystem === 'framework_based') {
        const { data: ratings } = await this.behavioralFrameworkService.getRatingsForStudent(
          studentId,
          branchId,
          academicYearId,
        );
        const scale = cfg.data.frameworkPreset?.defaultRatingScale ?? [];
        const orderByCode = new Map(scale.map((l) => [l.code, l.order]));
        const filtered = ratings.filter((r) => {
          const ym = r.assessmentMonth.slice(0, 7);
          return ym >= startYm && ym <= endYm;
        });
        const orders: number[] = [];
        for (const r of filtered) {
          for (const s of r.categoryScores) {
            const order = orderByCode.get(s.ratingCode);
            if (order != null) orders.push(order);
          }
        }
        if (orders.length === 0 || scale.length === 0) return ResultsService.SUMMARY_EMPTY;
        const avgOrder = orders.reduce((a, b) => a + b, 0) / orders.length;
        const closest = scale.reduce((best, level) =>
          Math.abs(level.order - avgOrder) < Math.abs(best.order - avgOrder) ? level : best,
        );
        return closest.label?.trim() || ResultsService.SUMMARY_EMPTY;
      }
    } catch {
      // Fall through to star-based assessments.
    }

    const { data: assessments } = await this.behavioralService.getByStudent(
      studentId,
      branchId,
      academicYearId,
    );
    if (!assessments?.length) return ResultsService.SUMMARY_EMPTY;
    const periods = this.buildBehavioralPeriods(
      assessments.map((a) => ({
        assessmentMonth: a.assessmentMonth,
        scores: a.scores.map((s) => ({ attributeName: s.attributeName, score: s.score })),
      })),
    ).filter((p) => p.period >= startYm && p.period <= endYm);
    let sum = 0;
    let count = 0;
    for (const p of periods) {
      for (const a of p.attributes) {
        sum += a.average;
        count += 1;
      }
    }
    if (count === 0) return ResultsService.SUMMARY_EMPTY;
    const avg = Math.round((sum / count) * 10) / 10;
    return `${avg.toFixed(1)}/5`;
  }

  /** Empty placeholder for PDF summary cells (ASCII-safe; avoid file-encoding issues with em dash). */
  private static readonly SUMMARY_EMPTY = '-';

  private formatAttendanceLabel(
    presentDays: number,
    lateDays: number,
    totalDays: number,
    percentage: number,
  ): string {
    if (!totalDays) return ResultsService.SUMMARY_EMPTY;
    // Count late with present for the fraction so it matches the % (present+late)/total.
    const attended = presentDays + lateDays;
    return `${attended}/${totalDays} (${percentage}%)`;
  }

  private async resolveAttendanceLabel(
    studentId: string,
    branchId: string,
    academicYearId: string,
    startDate: string,
    endDate: string,
  ): Promise<string> {
    try {
      const summary = await this.attendanceService.getAttendanceSummaryByStudent(
        studentId,
        branchId,
        academicYearId,
        startDate,
        endDate,
      );
      if (summary.totalDays > 0) {
        return this.formatAttendanceLabel(
          summary.presentDays,
          summary.lateDays,
          summary.totalDays,
          summary.percentage,
        );
      }
    } catch {
      // Fall through to a direct date-window query (authoritative for report cards).
    }

    // Fallback: count by date window only (do not require academic_year_id match).
    // Report-card ranges are calendar windows; year id mismatches should not blank the card.
    try {
      const supabase = this.supabaseConfig.getClient();
      const build = () =>
        supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('branch_id', branchId)
          .gte('date', startDate)
          .lte('date', endDate);

      const [presentRes, absentRes, lateRes, excusedRes] = await Promise.all([
        build().eq('status', 'present'),
        build().eq('status', 'absent'),
        build().eq('status', 'late'),
        build().eq('status', 'excused'),
      ]);
      throwIfDbError(presentRes.error);
      throwIfDbError(absentRes.error);
      throwIfDbError(lateRes.error);
      throwIfDbError(excusedRes.error);

      const presentDays = presentRes.count || 0;
      const absentDays = absentRes.count || 0;
      const lateDays = lateRes.count || 0;
      const excusedDays = excusedRes.count || 0;
      const totalDays = presentDays + absentDays + lateDays + excusedDays;
      if (!totalDays) return ResultsService.SUMMARY_EMPTY;
      const percentage = Math.round(((presentDays + lateDays) / totalDays) * 100);
      return this.formatAttendanceLabel(presentDays, lateDays, totalDays, percentage);
    } catch {
      return ResultsService.SUMMARY_EMPTY;
    }
  }

  private async resolveConductAndAttendanceLabels(params: {
    studentId: string;
    classSectionId: string;
    branchId: string;
    academicYearId: string;
    reportKind: ReportKind;
    resultType: ResultType;
    progressMonth?: number;
    termWindow?: 'until_mid' | 'after_mid';
  }): Promise<{ conductLabel: string; attendanceLabel: string }> {
    let range: { startDate: string; endDate: string };
    try {
      range = await this.resolveSummaryDateRange(params);
    } catch {
      return {
        conductLabel: ResultsService.SUMMARY_EMPTY,
        attendanceLabel: ResultsService.SUMMARY_EMPTY,
      };
    }

    // Resolve independently so a conduct failure never blanks attendance (and vice versa).
    const [conductLabel, attendanceLabel] = await Promise.all([
      this.resolveConductLabel(
        params.studentId,
        params.branchId,
        params.academicYearId,
        range.startDate,
        range.endDate,
      ).catch(() => ResultsService.SUMMARY_EMPTY),
      this.resolveAttendanceLabel(
        params.studentId,
        params.branchId,
        params.academicYearId,
        range.startDate,
        range.endDate,
      ).catch(() => ResultsService.SUMMARY_EMPTY),
    ]);
    return { conductLabel, attendanceLabel };
  }

  /**
   * Mid-term reports (basic + detailed + list + draft) share the until-mid assessment pool.
   * Progress month and explicit termWindow take precedence.
   */
  private resolveAssessmentScope(
    reportKind: ReportKind | undefined,
    resultType: ResultType | undefined,
    extra?: AssessmentScopeOptions,
  ): AssessmentScopeOptions | undefined {
    if (extra?.progressMonth != null || extra?.termWindow != null || extra?.phaseExamsOnly) {
      return extra;
    }
    if ((reportKind ?? 'term_report') === 'term_report' && resultType === 'mid_term') {
      return { termWindow: 'until_mid' };
    }
    return extra;
  }

  /**
   * Get assessments for class section and academic year.
   * Default: all assessments. Optional: phase exams only, calendar month, or mid/final term window.
   */
  private async getAssessmentsInScope(
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    resultType: ResultType,
    scope?: AssessmentScopeOptions,
  ): Promise<Map<string, { subjectId: string; totalMarks: number; subjectName?: string; title?: string }>> {
    const supabase = this.supabaseConfig.getClient();
    const { data: assessments, error } = await supabase
      .from('assessments')
      .select('id, subject_id, total_marks, title, due_date, created_at, assessment_type_id')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId);
    throwIfDbError(error);
    type AssessRow = {
      id: string;
      subject_id: string;
      total_marks: number;
      title?: string;
      due_date?: string | null;
      created_at?: string | null;
      assessment_type_id: string;
    };
    let list = (assessments || []) as AssessRow[];

    if (scope?.progressMonth != null) {
      const month = scope.progressMonth;
      list = list.filter((a) =>
        this.assessmentFallsInCalendarMonth(a.due_date, a.created_at, month),
      );
    }

    const needsTypeMeta = !!(scope?.phaseExamsOnly || scope?.termWindow);
    const typePhase = new Map<string, 'mid_term' | 'final' | null>();
    if (needsTypeMeta) {
      const typeIds = [...new Set(list.map((a) => a.assessment_type_id).filter(Boolean))];
      if (typeIds.length > 0) {
        const { data: types, error: typeErr } = await supabase
          .from('assessment_types')
          .select('id, name, is_term_examination')
          .in('id', typeIds)
          .eq('branch_id', branchId);
        throwIfDbError(typeErr);
        for (const t of types || []) {
          const row = t as { id: string; name: string; is_term_examination: boolean };
          if (!row.is_term_examination) {
            typePhase.set(row.id, null);
            continue;
          }
          typePhase.set(row.id, this.classifyTermExamPhase(row.name));
        }
      }
    }

    if (scope?.phaseExamsOnly) {
      const wantPhase = resultType === 'mid_term' || resultType === 'final' ? resultType : null;
      list = list.filter((a) => {
        const phase = typePhase.get(a.assessment_type_id) ?? null;
        return wantPhase != null && phase === wantPhase;
      });
    }

    if (scope?.termWindow) {
      let midCutoffMs: number | null = null;
      for (const a of list) {
        const phase = typePhase.get(a.assessment_type_id) ?? null;
        if (phase !== 'mid_term') continue;
        const ms = this.assessmentSortDateMs(a.due_date, a.created_at);
        if (ms == null) continue;
        if (midCutoffMs == null || ms > midCutoffMs) midCutoffMs = ms;
      }

      list = list.filter((a) => {
        const phase = typePhase.get(a.assessment_type_id) ?? null;
        const ms = this.assessmentSortDateMs(a.due_date, a.created_at);
        if (scope.termWindow === 'until_mid') {
          if (phase === 'final') return false;
          if (midCutoffMs == null) return true;
          if (ms == null) return phase === 'mid_term' || phase == null;
          return ms <= midCutoffMs;
        }
        // after_mid
        if (phase === 'mid_term') return false;
        if (midCutoffMs == null) return phase === 'final';
        if (ms == null) return phase === 'final';
        return ms > midCutoffMs || phase === 'final';
      });
    }

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

  /**
   * PDF banner phase: Interim until every student has grades for all phase exam assessments;
   * otherwise Mid-term / Final. No matching exams ⇒ not ready (Interim).
   */
  async resolveDisplayResultType(
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
  ): Promise<ResultType> {
    if (resultType !== 'mid_term' && resultType !== 'final') {
      return resultType === 'interim' ? 'interim' : resultType;
    }
    const readiness = await this.getMarksReadinessForClassSection(
      classSectionId,
      branchId,
      academicYearId,
      resultType,
    );
    if (readiness.length === 0) return 'interim';
    const allClear = readiness.every((r) => r.missingAssessmentTitles.length === 0);
    // Empty assessment set ⇒ every row has no missing titles, but we treat "no exams" as not ready.
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) return 'interim';
    const yearId = academicYearId ?? activeYear.id;
    const exams = await this.getAssessmentsInScope(classSectionId, branchId, yearId, resultType, {
      phaseExamsOnly: true,
    });
    if (exams.size === 0) return 'interim';
    return allClear ? resultType : 'interim';
  }

  async getResultForStudent(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId?: string,
    resultType: ResultType = 'final',
    scope?: AssessmentScopeOptions,
  ): Promise<StudentResultDto> {
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
    const classId = (cs as { class_id: string }).class_id;
    const sectionId = (cs as { section_id: string }).section_id;

    // Validate roster membership via enrolments (year-scoped placement).
    const { data: enrol, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .eq('class_id', classId)
      .eq('section_id', sectionId)
      .eq('status', 'active')
      .maybeSingle();
    throwIfDbError(enrolErr);
    if (!enrol) throw new NotFoundException('Student not found in this class section');

    // Fetch student display fields (do not filter by legacy year/class fields).
    const { data: student, error: stErr } = await supabase
      .from('students')
      .select('id, user_id, student_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(stErr);
    if (!student) throw new NotFoundException('Student not found');
    const studentRow = student as { id: string; user_id: string | null; student_id: string | null };

    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
      scope,
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
    scope?: AssessmentScopeOptions,
  ): Promise<AssessmentWiseEntryDto[]> {
    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
      scope,
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
      this.resolveAssessmentScope('term_report', resultType),
    );
    return this.ranksFromClassBatch(batch.students).get(studentId);
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

  /** Detailed result using assessment scope (mid/final windows, month) — not the unscoped RPC. */
  private async buildScopedDetailedResultForStudent(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string,
    resultType: ResultType,
    scope: AssessmentScopeOptions | undefined,
    classTeacherComment?: string,
  ): Promise<DetailedStudentResultDto> {
    const result = await this.getResultForStudent(
      studentId,
      classSectionId,
      branchId,
      academicYearId,
      resultType,
      scope,
    );
    const entries = await this.buildAssessmentWiseEntries(
      studentId,
      classSectionId,
      branchId,
      academicYearId,
      resultType,
      scope,
    );
    const supabase = this.supabaseConfig.getClient();
    const { data: cs } = await supabase
      .from('class_sections')
      .select('class_id')
      .eq('id', classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    const classId = (cs as { class_id: string } | null)?.class_id;
    const [classRank, schoolRank, generatedParagraph] = await Promise.all([
      this.getClassRank(studentId, classSectionId, branchId, academicYearId, resultType),
      this.getSchoolRank(studentId, branchId, academicYearId, resultType),
      classId
        ? this.getGeneratedParagraph(classId, result.overallPercentage ?? 0)
        : Promise.resolve('Keep up the effort and focus on consistent progress.'),
    ]);
    return new DetailedStudentResultDto({
      studentId: result.studentId,
      studentName: result.studentName,
      studentStudentId: result.studentStudentId,
      subjects: result.subjects,
      overallPercentage: result.overallPercentage ?? 0,
      overallLetterGrade: result.overallLetterGrade,
      assessmentWiseEntries: entries,
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
    scope?: AssessmentScopeOptions,
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
        .from('student_enrolments')
        .select('student_id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', yearId)
        .eq('class_id', c.class_id)
        .eq('section_id', c.section_id)
        .eq('status', 'active'),
    ]);
    const className = (classRes.data as { display_name?: string } | null)?.display_name ?? '';
    const sectionName = (sectionRes.data as { name?: string } | null)?.name ?? '';
    const ids = ((studentRows.data || []) as Array<{ student_id: string }>).map((r) => r.student_id);
    const { data: studentsData, error: stErr } =
      ids.length > 0
        ? await supabase
            .from('students')
            .select('id, user_id, student_id')
            .in('id', ids)
            .eq('branch_id', branchId)
        : { data: [], error: null };
    throwIfDbError(stErr);
    const students = (studentsData || []) as {
      id: string;
      user_id: string | null;
      student_id: string | null;
    }[];

    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
      scope,
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
    resultType: ResultType | undefined,
    generatedBy: string,
    options?: { reportKind?: ReportKind; progressSequence?: number },
  ): Promise<ResultCardDto> {
    const reportKind: ReportKind = options?.reportKind ?? 'term_report';
    if (reportKind === 'annual_report') {
      throw new BadRequestException('Annual reports can no longer be created');
    }
    if (reportKind === 'term_report' && resultType === 'interim') {
      throw new BadRequestException('Interim is not a selectable term phase; use Mid-term or Final');
    }
    if (reportKind === 'term_report' && !resultType) {
      throw new BadRequestException('resultType is required for term reports');
    }
    if (reportKind === 'progress_report') {
      const month = options?.progressSequence;
      if (month == null || month < 1 || month > 12) {
        throw new BadRequestException(
          'progressSequence (calendar month 1–12) is required for progress reports',
        );
      }
    }
    const termPhase = reportKind === 'term_report' ? ((resultType ?? 'final') as ResultType) : null;
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const progressMonth =
      reportKind === 'progress_report' ? options?.progressSequence : undefined;
    const scope = this.resolveAssessmentScope(reportKind, resultType ?? undefined, {
      ...(progressMonth != null ? { progressMonth } : {}),
    });

    const type = (resultType ?? 'final') as ResultType;
    const legacyResultType = type;
    const result = await this.getResultForStudent(
      studentId,
      classSectionId,
      branchId,
      academicYearId,
      type,
      scope,
    );
    const resultData: Record<string, unknown> = {
      studentId: result.studentId,
      studentName: result.studentName,
      studentStudentId: result.studentStudentId,
      subjects: result.subjects,
      overallPercentage: result.overallPercentage,
      overallLetterGrade: result.overallLetterGrade,
      reportKind,
      ...(progressMonth != null ? { progressMonth } : {}),
    };

    const supabase = this.supabaseConfig.getClient();
    const progressSequence: number | null =
      reportKind === 'progress_report' ? (options?.progressSequence ?? null) : null;

    const rowBase = {
      student_id: studentId,
      class_section_id: classSectionId,
      academic_year_id: yearId,
      branch_id: branchId,
      result_type: legacyResultType,
      report_kind: reportKind,
      term_phase: termPhase,
      progress_sequence: progressSequence,
      generated_by: generatedBy,
      result_data: resultData,
      status: 'draft',
      updated_at: new Date().toISOString(),
    };

    let existingQuery = supabase
      .from('result_cards')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_section_id', classSectionId)
      .eq('academic_year_id', yearId)
      .eq('report_kind', reportKind);
    if (reportKind === 'term_report') {
      existingQuery = existingQuery.eq('term_phase', termPhase!);
    } else if (reportKind === 'progress_report') {
      existingQuery = existingQuery.eq('progress_sequence', progressSequence!);
    }
    const { data: existing } = await existingQuery.maybeSingle();

    let out: { id: string; created_at: string; updated_at: string; [k: string]: unknown };
    if (existing) {
      const { data: updated, error } = await supabase
        .from('result_cards')
        .update({
          result_data: rowBase.result_data,
          generated_at: new Date().toISOString(),
          generated_by: rowBase.generated_by,
          updated_at: rowBase.updated_at,
          status: 'draft',
          result_type: rowBase.result_type,
          report_kind: rowBase.report_kind,
          term_phase: rowBase.term_phase,
          progress_sequence: rowBase.progress_sequence,
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
          student_id: rowBase.student_id,
          class_section_id: rowBase.class_section_id,
          academic_year_id: rowBase.academic_year_id,
          branch_id: rowBase.branch_id,
          result_type: rowBase.result_type,
          report_kind: rowBase.report_kind,
          term_phase: rowBase.term_phase,
          progress_sequence: rowBase.progress_sequence,
          generated_by: rowBase.generated_by,
          result_data: rowBase.result_data,
          status: rowBase.status,
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
    if (status === 'draft') {
      update.approved_by = null;
      update.approved_at = null;
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
    reportKindFilter?: ReportKind,
  ): Promise<ResultCardDto[]> {
    const supabase = this.supabaseConfig.getClient();
    let query = supabase
      .from('result_cards')
      .select('*')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .order('generated_at', { ascending: false });
    if (academicYearId) query = query.eq('academic_year_id', academicYearId);
    if (reportKindFilter) {
      query = query.eq('report_kind', reportKindFilter);
      if (reportKindFilter === 'term_report' && resultType) {
        query = query.eq('term_phase', resultType);
      }
    } else if (resultType) {
      query = query.eq('report_kind', 'term_report').eq('term_phase', resultType);
    }
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
    reportKind: ReportKind = 'term_report',
    progressSequence?: number,
  ): Promise<ResultCardDto[]> {
    const supabase = this.supabaseConfig.getClient();
    let query = supabase
      .from('result_cards')
      .select('*')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', academicYearId)
      .eq('report_kind', reportKind);
    if (reportKind === 'term_report') {
      query = query.eq('term_phase', resultType);
    } else if (reportKind === 'progress_report' && progressSequence != null) {
      query = query.eq('progress_sequence', progressSequence);
    }
    const { data, error } = await query.order('student_id').order('generated_at', { ascending: false });
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
      reportKind: (row.report_kind as string) || 'term_report',
      termPhase: (row.term_phase as string) || undefined,
      progressSequence:
        row.progress_sequence != null ? Number(row.progress_sequence) : undefined,
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
    const existing = await this.getResultCardById(id, branchId);
    if (!existing) throw new NotFoundException('Result card not found');
    if (existing.status === 'published') {
      throw new ForbiddenException('Cannot edit remarks on a published report card');
    }
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
    cardReportKind: ReportKind = 'term_report',
    progressSequence?: number,
  ): Promise<string | undefined> {
    const cards = await this.listResultCardsByStudent(
      studentId,
      branchId,
      academicYearId,
      cardReportKind === 'term_report' ? resultType : undefined,
      false,
      cardReportKind !== 'term_report' ? cardReportKind : undefined,
    );
    const scoped = cards.filter(
      (c) => c.classSectionId === classSectionId && c.academicYearId === academicYearId,
    );
    if (cardReportKind === 'annual_report') {
      return scoped.find((c) => c.reportKind === 'annual_report')?.classTeacherComment;
    }
    if (cardReportKind === 'progress_report') {
      if (progressSequence != null) {
        return scoped.find((c) => c.progressSequence === progressSequence)?.classTeacherComment;
      }
      const sorted = [...scoped].sort(
        (a, b) => (b.progressSequence ?? 0) - (a.progressSequence ?? 0),
      );
      return sorted[0]?.classTeacherComment;
    }
    const card = scoped.find((c) => (c.termPhase ?? c.resultType) === resultType);
    return card?.classTeacherComment;
  }

  async generateResultCardPdf(
    studentId: string,
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
    options?: {
      reportType?: 'basic' | 'detailed';
      pdfVariant?: 'minimal' | 'modern';
      reportKind?: ReportKind;
      progressMonth?: number;
    },
  ): Promise<Buffer> {
    const reportType = options?.reportType ?? 'basic';
    const reportKind: ReportKind = options?.reportKind ?? 'term_report';
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;

    const progressMonth =
      reportKind === 'progress_report' ? options?.progressMonth : undefined;
    if (reportKind === 'progress_report' && (progressMonth == null || progressMonth < 1 || progressMonth > 12)) {
      // Legacy progress cards without month: fall back to latest sequence comment only; marks use all assessments.
    }
    const scope = this.resolveAssessmentScope(reportKind, resultType, {
      ...(progressMonth != null && progressMonth >= 1 && progressMonth <= 12
        ? { progressMonth }
        : {}),
    });

    const displayResultType =
      reportKind === 'term_report'
        ? await this.resolveDisplayResultType(classSectionId, branchId, yearId, resultType)
        : resultType;

    const settingsPdf = (await this.resultReportSettingsService.get(branchId)).data.pdfVariant;
    const effectiveVariant: 'minimal' | 'modern' =
      options?.pdfVariant === 'minimal' || options?.pdfVariant === 'modern'
        ? options.pdfVariant
        : settingsPdf === 'minimal' || settingsPdf === 'modern'
          ? settingsPdf
          : 'modern';

    const pdfPrimaryHex = await this.getTenantPdfPrimaryHex(branchId);
    const pdfThemeCss = buildPdfThemeVariablesCss(pdfPrimaryHex);

    if (reportType === 'detailed') {
      // Progress / month-scoped: build from scoped marks instead of unscoped RPC.
      if (reportKind === 'progress_report' && scope) {
        const comment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          resultType,
          'progress_report',
          progressMonth,
        );
        const [detailed, extras] = await Promise.all([
          this.buildScopedDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            resultType,
            scope,
            comment,
          ),
          this.resolveConductAndAttendanceLabels({
            studentId,
            classSectionId,
            branchId,
            academicYearId: yearId,
            reportKind,
            resultType,
            progressMonth,
          }),
        ]);
        return this.renderDetailedPdfSingle(
          detailed,
          'Progress Report',
          classSectionId,
          branchId,
          effectiveVariant,
          yearId,
          pdfThemeCss,
          extras,
        );
      }

      // Final term detailed: page 1 = until mid, page 2 = after mid (max 2 pages, no duplicate full-year dump).
      if (reportKind === 'term_report' && resultType === 'final') {
        const midComment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          'mid_term',
          'term_report',
        );
        const finalComment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          'final',
          'term_report',
        );
        const [midDetail, finalDetail, midExtras, finalExtras] = await Promise.all([
          this.buildScopedDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            'mid_term',
            { termWindow: 'until_mid' },
            midComment,
          ),
          this.buildScopedDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            'final',
            { termWindow: 'after_mid' },
            finalComment,
          ),
          this.resolveConductAndAttendanceLabels({
            studentId,
            classSectionId,
            branchId,
            academicYearId: yearId,
            reportKind: 'term_report',
            resultType: 'mid_term',
            termWindow: 'until_mid',
          }),
          this.resolveConductAndAttendanceLabels({
            studentId,
            classSectionId,
            branchId,
            academicYearId: yearId,
            reportKind: 'term_report',
            resultType: 'final',
            termWindow: 'after_mid',
          }),
        ]);
        return this.renderDetailedPdfTwoPages(
          midDetail,
          finalDetail,
          classSectionId,
          branchId,
          effectiveVariant,
          yearId,
          pdfThemeCss,
          midExtras,
          finalExtras,
        );
      }

      // Mid-term (or interim display) detailed: single page, until-mid assessments only.
      if (reportKind === 'term_report') {
        const comment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          resultType,
          'term_report',
        );
        const [detailed, extras] = await Promise.all([
          this.buildScopedDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            resultType === 'mid_term' ? 'mid_term' : resultType,
            { termWindow: 'until_mid' },
            comment,
          ),
          this.resolveConductAndAttendanceLabels({
            studentId,
            classSectionId,
            branchId,
            academicYearId: yearId,
            reportKind: 'term_report',
            resultType: resultType === 'mid_term' ? 'mid_term' : resultType,
            termWindow: 'until_mid',
          }),
        ]);
        const resultTypeLabel =
          displayResultType === 'interim'
            ? 'Interim Report'
            : displayResultType === 'mid_term'
              ? 'Mid-term Report'
              : 'Final Term Report';
        return this.renderDetailedPdfSingle(
          detailed,
          resultTypeLabel,
          classSectionId,
          branchId,
          effectiveVariant,
          yearId,
          pdfThemeCss,
          extras,
        );
      }

      // Legacy annual / other: keep previous RPC-based detailed path.
      const useTwoTermPages = reportKind === 'annual_report';
      if (useTwoTermPages) {
        const midComment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          'mid_term',
          'term_report',
        );
        const finalComment = await this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          'final',
          'term_report',
        );
        const [midDetail, finalDetail, midExtras, finalExtras] = await Promise.all([
          this.buildScopedDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            'mid_term',
            { termWindow: 'until_mid' },
            midComment,
          ),
          this.buildScopedDetailedResultForStudent(
            studentId,
            classSectionId,
            branchId,
            yearId,
            'final',
            { termWindow: 'after_mid' },
            finalComment,
          ),
          this.resolveConductAndAttendanceLabels({
            studentId,
            classSectionId,
            branchId,
            academicYearId: yearId,
            reportKind: 'term_report',
            resultType: 'mid_term',
            termWindow: 'until_mid',
          }),
          this.resolveConductAndAttendanceLabels({
            studentId,
            classSectionId,
            branchId,
            academicYearId: yearId,
            reportKind: 'term_report',
            resultType: 'final',
            termWindow: 'after_mid',
          }),
        ]);
        return this.renderDetailedPdfTwoPages(
          midDetail,
          finalDetail,
          classSectionId,
          branchId,
          effectiveVariant,
          yearId,
          pdfThemeCss,
          midExtras,
          finalExtras,
        );
      }
      const commentKind: ReportKind =
        reportKind === 'progress_report' ? 'progress_report' : 'term_report';
      const comment = await this.getResultCardComment(
        studentId,
        classSectionId,
        branchId,
        yearId,
        resultType,
        commentKind,
        progressMonth,
      );
      const [detailed, extras] = await Promise.all([
        this.getDetailedResultForStudent(
          studentId,
          classSectionId,
          branchId,
          yearId,
          resultType,
          comment,
        ),
        this.resolveConductAndAttendanceLabels({
          studentId,
          classSectionId,
          branchId,
          academicYearId: yearId,
          reportKind,
          resultType,
          progressMonth,
        }),
      ]);
      const resultTypeLabel =
        displayResultType === 'interim'
          ? 'Interim Result'
          : displayResultType === 'mid_term'
            ? 'Mid-term Result'
            : 'Final Result';
      return this.renderDetailedPdfSingle(
        detailed,
        resultTypeLabel,
        classSectionId,
        branchId,
        effectiveVariant,
        yearId,
        pdfThemeCss,
        extras,
      );
    }

    // One class-section load for student marks + rank (avoids getResultForStudent + full-class getClassRank).
    const batch = await this.getResultsForClassSection(
      classSectionId,
      branchId,
      yearId,
      resultType,
      scope,
    );
    const result = batch.students.find((s) => s.studentId === studentId);
    if (!result) throw new NotFoundException('Student not found in this class section');
    const classRank = this.ranksFromClassBatch(batch.students).get(studentId);
    const className = batch.className;
    const sectionName = batch.sectionName;
    const classLabel = `${className} - ${sectionName}`.trim() || '—';
    const commentKind: ReportKind =
      reportKind === 'progress_report'
        ? 'progress_report'
        : reportKind === 'annual_report'
          ? 'annual_report'
          : 'term_report';
    const supabase = this.supabaseConfig.getClient();
    const [{ line1: schoolLine1, line2: schoolLine2 }, ayRow, classTeacherComment, extras] =
      await Promise.all([
        this.getReportSchoolLines(branchId),
        supabase.from('academic_years').select('name').eq('id', yearId).maybeSingle().then((r) => r.data),
        this.getResultCardComment(
          studentId,
          classSectionId,
          branchId,
          yearId,
          resultType,
          commentKind,
          progressMonth,
        ),
        this.resolveConductAndAttendanceLabels({
          studentId,
          classSectionId,
          branchId,
          academicYearId: yearId,
          reportKind,
          resultType,
          progressMonth,
          ...(scope?.termWindow ? { termWindow: scope.termWindow } : {}),
        }),
      ]);
    const academicYearName = (ayRow as { name?: string } | null)?.name?.trim() || '—';
    const htmlForPdf = this.composeBasicResultCardHtml({
      result,
      classRank,
      className,
      sectionName,
      classLabel,
      schoolLine1,
      schoolLine2,
      academicYearName,
      resultType: displayResultType,
      reportKind,
      effectiveVariant,
      pdfThemeCss,
      classTeacherComment,
      conductLabel: extras.conductLabel,
      attendanceLabel: extras.attendanceLabel,
    });

    return this.printResultCardHtmlToPdf(htmlForPdf);
  }

  /** Build basic (non-detailed) result-card HTML from an already-loaded student result. */
  private composeBasicResultCardHtml(params: {
    result: StudentResultDto;
    classRank: number | undefined;
    className: string;
    sectionName: string;
    classLabel: string;
    schoolLine1: string;
    schoolLine2: string;
    academicYearName: string;
    resultType: ResultType;
    reportKind: ReportKind;
    effectiveVariant: 'minimal' | 'modern';
    pdfThemeCss: string;
    classTeacherComment?: string;
    conductLabel?: string;
    attendanceLabel?: string;
  }): string {
    const {
      result,
      classRank,
      className,
      sectionName,
      classLabel,
      schoolLine1,
      schoolLine2,
      academicYearName,
      resultType,
      reportKind,
      effectiveVariant,
      pdfThemeCss,
      classTeacherComment,
      conductLabel,
      attendanceLabel,
    } = params;
    const reportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const templatePrefix =
      reportKind === 'progress_report'
        ? 'progress-report'
        : reportKind === 'annual_report'
          ? 'annual-report'
          : 'term-report';
    const templateFile = `${templatePrefix}-${effectiveVariant}.html`;
    const styles = readDesignTemplateStyleBlock(templateFile);

    const resultTypeLabel =
      resultType === 'interim' ? 'Interim Result' : resultType === 'mid_term' ? 'Mid-term Result' : 'Final Result';

    if (styles) {
      const bodyInner =
        reportKind === 'progress_report'
          ? effectiveVariant === 'modern'
            ? buildModernProgressInner({
                schoolLine1,
                schoolLine2,
                academicYearName,
                studentName: result.studentName,
                rollNumber: result.studentStudentId ?? '—',
                classLabel,
                reportDate,
                result,
                classTeacherComment,
                conductLabel,
                attendanceLabel,
              })
            : buildMinimalProgressInner({
                schoolLine1,
                schoolLine2,
                academicYearName,
                studentName: result.studentName,
                rollNumber: result.studentStudentId ?? '—',
                classLabel,
                reportDate,
                result,
                classTeacherComment,
                conductLabel,
                attendanceLabel,
              })
          : effectiveVariant === 'modern'
            ? buildModernTermAnnualReportInner({
                reportKind,
                resultType,
                schoolLine1,
                schoolLine2,
                academicYearName,
                studentName: result.studentName,
                rollNumber: result.studentStudentId ?? '—',
                classLabel,
                classRank: classRank ?? null,
                reportDate,
                result,
                classTeacherComment,
                conductLabel,
                attendanceLabel,
              })
            : buildMinimalTermAnnualReportInner({
                reportKind,
                resultType,
                schoolLine1,
                schoolLine2,
                academicYearName,
                studentName: result.studentName,
                rollNumber: result.studentStudentId ?? '—',
                classLabel,
                classRank: classRank ?? null,
                reportDate,
                result,
                classTeacherComment,
                conductLabel,
                attendanceLabel,
              });
      return composeDesignPdfHtml(
        styles,
        bodyInner,
        reportKind === 'progress_report' ? 'progress-report' : 'report-card',
        pdfThemeCss,
      );
    }

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
      classRank != null ? `<p class="sub">Class position: ${classRank}</p>` : '';
    return `
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
    pdfVariant: 'minimal' | 'modern',
    academicYearId: string,
    pdfThemeCss: string,
    extras?: { conductLabel: string; attendanceLabel: string },
  ): Promise<Buffer> {
    return this.buildDetailedPdf(
      d,
      resultTypeLabel,
      classSectionId,
      branchId,
      pdfVariant,
      academicYearId,
      pdfThemeCss,
      extras,
    );
  }

  private async renderDetailedPdfTwoPages(
    midDetail: DetailedStudentResultDto,
    finalDetail: DetailedStudentResultDto,
    classSectionId: string,
    branchId: string,
    pdfVariant: 'minimal' | 'modern',
    academicYearId: string,
    pdfThemeCss: string,
    midExtras?: { conductLabel: string; attendanceLabel: string },
    finalExtras?: { conductLabel: string; attendanceLabel: string },
  ): Promise<Buffer> {
    const templateFile = `term-report-${pdfVariant}.html`;
    const styles = readDesignTemplateStyleBlock(templateFile);
    const labels = await this.getClassSectionLabels(classSectionId, branchId);
    const classLabel = `${labels.className} - ${labels.sectionName}`.trim() || '—';
    const school = await this.getReportSchoolLines(branchId);
    const supabase = this.supabaseConfig.getClient();
    const { data: ayRow } = await supabase
      .from('academic_years')
      .select('name')
      .eq('id', academicYearId)
      .maybeSingle();
    const academicYearName = (ayRow as { name?: string } | null)?.name?.trim() || '—';
    const reportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let fullHtml: string;
    if (styles) {
      const inner1 =
        pdfVariant === 'modern'
          ? buildModernDetailedPageInner(
              midDetail,
              'Mid-term Report',
              classLabel,
              school.line1,
              school.line2,
              academicYearName,
              reportDate,
              {
                compact: true,
                showSignatures: false,
                showFooter: false,
                conductLabel: midExtras?.conductLabel,
                attendanceLabel: midExtras?.attendanceLabel,
              },
            )
          : buildDetailedMinimalPageInner(
              midDetail,
              'Mid-term Report',
              classLabel,
              school.line1,
              school.line2,
              academicYearName,
              reportDate,
              {
                compact: true,
                showSignatures: false,
                showFooter: false,
                conductLabel: midExtras?.conductLabel,
                attendanceLabel: midExtras?.attendanceLabel,
              },
            );
      const inner2 =
        pdfVariant === 'modern'
          ? buildModernDetailedPageInner(
              finalDetail,
              'Final Term Report',
              classLabel,
              school.line1,
              school.line2,
              academicYearName,
              reportDate,
              {
                headerMode: 'continuation',
                compact: true,
                showSignatures: true,
                showFooter: true,
                conductLabel: finalExtras?.conductLabel,
                attendanceLabel: finalExtras?.attendanceLabel,
              },
            )
          : buildDetailedMinimalPageInner(
              finalDetail,
              'Final Term Report',
              classLabel,
              school.line1,
              school.line2,
              academicYearName,
              reportDate,
              {
                compact: true,
                showSignatures: true,
                showFooter: true,
                conductLabel: finalExtras?.conductLabel,
                attendanceLabel: finalExtras?.attendanceLabel,
              },
            );
      fullHtml = composeDesignPdfHtmlMultiCard(styles, [inner1, inner2], pdfThemeCss, true);
    } else {
      const htmlPage1 = await this.buildDetailedHtmlInner(
        midDetail,
        'Mid-term Report',
        classSectionId,
        branchId,
      );
      const htmlPage2 = await this.buildDetailedHtmlInner(
        finalDetail,
        'Final Term Report',
        classSectionId,
        branchId,
      );
      fullHtml = `
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
    }
    return this.printResultCardHtmlToPdf(fullHtml);
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
    pdfVariant: 'minimal' | 'modern',
    academicYearId: string,
    pdfThemeCss: string,
    extras?: { conductLabel: string; attendanceLabel: string },
  ): Promise<Buffer> {
    const templateFile = `term-report-${pdfVariant}.html`;
    const styles = readDesignTemplateStyleBlock(templateFile);
    const labels = await this.getClassSectionLabels(classSectionId, branchId);
    const classLabel = `${labels.className} - ${labels.sectionName}`.trim() || '—';
    const school = await this.getReportSchoolLines(branchId);
    const supabase = this.supabaseConfig.getClient();
    const { data: ayRow } = await supabase
      .from('academic_years')
      .select('name')
      .eq('id', academicYearId)
      .maybeSingle();
    const academicYearName = (ayRow as { name?: string } | null)?.name?.trim() || '—';
    const reportDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let htmlContent: string;
    if (styles) {
      const inner =
        pdfVariant === 'modern'
          ? buildModernDetailedPageInner(
              d,
              resultTypeLabel,
              classLabel,
              school.line1,
              school.line2,
              academicYearName,
              reportDate,
              {
                compact: true,
                showSignatures: true,
                showFooter: true,
                conductLabel: extras?.conductLabel,
                attendanceLabel: extras?.attendanceLabel,
              },
            )
          : buildDetailedMinimalPageInner(
              d,
              resultTypeLabel,
              classLabel,
              school.line1,
              school.line2,
              academicYearName,
              reportDate,
              {
                compact: true,
                showSignatures: true,
                showFooter: true,
                conductLabel: extras?.conductLabel,
                attendanceLabel: extras?.attendanceLabel,
              },
            );
      htmlContent = composeDesignPdfHtml(styles, inner, 'report-card', pdfThemeCss, true);
    } else {
      const inner = await this.buildDetailedHtmlInner(d, resultTypeLabel, classSectionId, branchId);
      htmlContent = `<!DOCTYPE html>
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
    }
    return this.printResultCardHtmlToPdf(htmlContent);
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
   * Generate behavioural report PDF (star-based UI). Throws if no behavioural data
   * when monthFilter is omitted; with monthFilter may render an empty-state PDF.
   */
  async generateBehavioralReportPdf(
    studentId: string,
    branchId: string,
    academicYearId: string | undefined,
    options?: { month?: number; allowEmpty?: boolean },
  ): Promise<Buffer> {
    const { data: assessments } = await this.behavioralService.getByStudent(
      studentId,
      branchId,
      academicYearId,
    );
    let periods = this.buildBehavioralPeriods(
      (assessments || []).map((a) => ({
        assessmentMonth: a.assessmentMonth,
        scores: a.scores.map((s) => ({ attributeName: s.attributeName, score: s.score })),
      })),
    );
    if (options?.month != null && options.month >= 1 && options.month <= 12) {
      const mm = String(options.month).padStart(2, '0');
      periods = periods.filter((p) => p.period.endsWith(`-${mm}`));
    }
    if (!periods.length) {
      if (!options?.allowEmpty) {
        throw new BadRequestException(
          'Behavioural metrics not set for this student. Please contact the administrator.',
        );
      }
    }
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
    if (periods.length === 0) {
      tableRows =
        '<tr><td colspan="2">No behavioural ratings recorded for this month.</td></tr>';
    } else {
      for (const p of periods) {
        const attrMap = Object.fromEntries(p.attributes.map((a) => [a.attributeName, a.average]));
        tableRows += `<tr><td>${this.escapeHtml(p.period)}</td>`;
        for (const attr of allAttributes) {
          const value = attrMap[attr];
          tableRows += `<td>${value != null ? `<span class="stars">${renderStars(value)} ${value.toFixed(1)}</span>` : '—'}</td>`;
        }
        tableRows += '</tr>\n';
      }
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
    const monthTitle =
      options?.month != null
        ? ` — ${new Date(2000, options.month - 1, 1).toLocaleString('en-GB', { month: 'long' })}`
        : '';
    const overallBlock =
      overallCount > 0
        ? `<div class="overall">Overall (star-based): <span class="stars">${renderStars(overallAverage)} ${overallAverage.toFixed(1)}</span></div>`
        : '<div class="overall">No ratings in this period.</div>';
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
    <h1>Behavioural Report${this.escapeHtml(monthTitle)}</h1>
    <p class="sub">${this.escapeHtml(studentName)}</p>
  </div>
  <table>
    <thead><tr><th>Period</th>${allAttributes.map((a) => `<th>${this.escapeHtml(a)}</th>`).join('') || '<th>Attributes</th>'}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  ${overallBlock}
</body>
</html>`;
    const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.emulateMediaType('print');
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

  /**
   * Parent monthly pack: require a published Progress card for the given calendar month.
   */
  private async ensurePublishedProgressMonth(
    studentId: string,
    branchId: string,
    academicYearId: string,
    month: number,
  ): Promise<void> {
    const cards = await this.listResultCardsByStudent(
      studentId,
      branchId,
      academicYearId,
      undefined,
      true,
      'progress_report',
    );
    const found = cards.some(
      (c) => c.progressSequence === month && c.status === 'published',
    );
    if (!found) {
      throw new ForbiddenException(
        'Attendance and behaviour pack downloads are available only when a Progress report for this month is published.',
      );
    }
  }

  async generateMonthlyPackAttendancePdf(
    studentId: string,
    branchId: string,
    academicYearId: string | undefined,
    month: number,
  ): Promise<Buffer> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be an integer from 1 to 12');
    }
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;
    await this.ensurePublishedProgressMonth(studentId, branchId, yearId, month);

    const supabase = this.supabaseConfig.getClient();
    const { data: yearRow } = await supabase
      .from('academic_years')
      .select('start_date, end_date, name')
      .eq('id', yearId)
      .maybeSingle();
    const yearStart = (yearRow as { start_date?: string } | null)?.start_date;
    const yearEnd = (yearRow as { end_date?: string } | null)?.end_date;
    const yearName = (yearRow as { name?: string } | null)?.name?.trim() || '—';
    if (!yearStart || !yearEnd) {
      throw new BadRequestException('Academic year dates are not configured');
    }
    const range = this.calendarMonthRangeWithinYear(yearStart, yearEnd, month);
    const summary = await this.attendanceService.getAttendanceSummaryByStudent(
      studentId,
      branchId,
      yearId,
      range.startDate,
      range.endDate,
    );
    const studentName = await this.getStudentName(studentId);
    const monthLabel = new Date(2000, month - 1, 1).toLocaleString('en-GB', { month: 'long' });
    const pct = summary.totalDays ? `${summary.percentage}%` : '—';
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
  .summary { margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 4px; font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>Attendance — ${this.escapeHtml(monthLabel)}</h1>
    <p class="sub">${this.escapeHtml(studentName)}</p>
    <p class="sub">${this.escapeHtml(yearName)} · ${this.escapeHtml(range.startDate)} to ${this.escapeHtml(range.endDate)}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Present</th>
        <th>Absent</th>
        <th>Late</th>
        <th>Excused</th>
        <th>Total days</th>
        <th>Attendance %</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${summary.presentDays}</td>
        <td>${summary.absentDays}</td>
        <td>${summary.lateDays}</td>
        <td>${summary.excusedDays}</td>
        <td>${summary.totalDays}</td>
        <td>${this.escapeHtml(pct)}</td>
      </tr>
    </tbody>
  </table>
  <div class="summary">${
    summary.totalDays
      ? `Present ${summary.presentDays} of ${summary.totalDays} recorded days (${summary.percentage}%).`
      : 'No attendance recorded for this month.'
  }</div>
</body>
</html>`;
    const { headerTemplate, footerTemplate } = await this.getPdfBranding(branchId, 'en');
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.emulateMediaType('print');
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

  async generateMonthlyPackBehaviourPdf(
    studentId: string,
    branchId: string,
    academicYearId: string | undefined,
    month: number,
  ): Promise<Buffer> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be an integer from 1 to 12');
    }
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;
    await this.ensurePublishedProgressMonth(studentId, branchId, yearId, month);
    return this.generateBehavioralReportPdf(studentId, branchId, yearId, {
      month,
      allowEmpty: true,
    });
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

  private async getStudentNumericId(studentId: string): Promise<string | undefined> {
    const supabase = this.supabaseConfig.getClient();
    const { data } = await supabase
      .from('students')
      .select('student_id')
      .eq('id', studentId)
      .maybeSingle();
    const numericId = (data as { student_id?: string | null } | null)?.student_id ?? undefined;
    return numericId?.toString().trim() || undefined;
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
    const [studentName, studentNumericId, yearCode] = await Promise.all([
      this.getStudentName(studentId),
      this.getStudentNumericId(studentId),
      this.getAcademicYearCode(academicYearId, branchId),
    ]);
    const clean = (value: string): string =>
      value.replace(/\s+/g, '').replace(/[^A-Za-z0-9]/g, '');
    const studentSeg = clean(studentName) || 'Student';
    const studentIdSeg = studentNumericId ? clean(studentNumericId) : '';
    const typeLabel = reportType === 'detailed' ? 'DetailedReport' : 'BasicReport';
    const yearSeg = clean(yearCode) || 'Year';

    // Required format: StudentName-StudentID-BasicReport/DetailedReport-Year.pdf
    // StudentID is the numeric student_id stored in DB (e.g. 0058).
    const parts = [studentSeg, studentIdSeg || 'StudentID', typeLabel, yearSeg].filter(Boolean);
    return `${parts.join('-')}.pdf`;
  }

  async getMarksReadinessForClassSection(
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
  ): Promise<{ studentId: string; missingAssessmentTitles: string[] }[]> {
    const batch = await this.getResultsForClassSection(
      classSectionId,
      branchId,
      academicYearId,
      resultType,
    );
    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) throw new BadRequestException('No active academic year found');
    const yearId = academicYearId ?? activeYear.id;
    const assessmentMap = await this.getAssessmentsInScope(
      classSectionId,
      branchId,
      yearId,
      resultType,
      { phaseExamsOnly: true },
    );
    const titlesById = new Map<string, string>();
    for (const [id, info] of assessmentMap) {
      titlesById.set(id, info.title ?? 'Assessment');
    }
    const assessmentIds = [...assessmentMap.keys()];
    if (assessmentIds.length === 0) {
      // No matching mid/final exams configured — treat every student as missing readiness.
      return batch.students.map((s) => ({
        studentId: s.studentId,
        missingAssessmentTitles: ['No mid/final term examinations configured'],
      }));
    }
    const studentIds = batch.students.map((s) => s.studentId);
    const supabase = this.supabaseConfig.getClient();
    const { data: grades, error } = await supabase
      .from('student_grades')
      .select('student_id, assessment_id')
      .in('student_id', studentIds)
      .in('assessment_id', assessmentIds)
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId);
    throwIfDbError(error);
    const have = new Set<string>();
    for (const g of grades || []) {
      const r = g as { student_id: string; assessment_id: string };
      have.add(`${r.student_id}:${r.assessment_id}`);
    }
    return batch.students.map((s) => {
      const missing: string[] = [];
      for (const aid of assessmentIds) {
        if (!have.has(`${s.studentId}:${aid}`)) {
          missing.push(titlesById.get(aid) ?? aid);
        }
      }
      return { studentId: s.studentId, missingAssessmentTitles: missing };
    });
  }

  async listResultCardDeliveries(
    resultCardId: string,
    branchId: string,
  ): Promise<Record<string, unknown>[]> {
    const card = await this.getResultCardById(resultCardId, branchId);
    if (!card) throw new NotFoundException('Result card not found');
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('result_card_deliveries')
      .select(
        'id, result_card_id, recipient_type, recipient_id, recipient_contact, delivery_method, delivery_status, delivered_at, delivered_by, opened_at, metadata, created_at',
      )
      .eq('result_card_id', resultCardId)
      .order('created_at', { ascending: false });
    throwIfDbError(error);
    return (data || []) as Record<string, unknown>[];
  }

  async recordResultCardDelivery(
    resultCardId: string,
    branchId: string,
    userId: string,
    input: {
      deliveryMethod: string;
      recipientContact?: string;
      deliveryStatus?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> {
    const card = await this.getResultCardById(resultCardId, branchId);
    if (!card) throw new NotFoundException('Result card not found');
    if (card.status !== 'published') {
      throw new BadRequestException('Only published report cards can receive delivery records');
    }
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('result_card_deliveries')
      .insert({
        result_card_id: resultCardId,
        delivery_method: input.deliveryMethod,
        recipient_contact: input.recipientContact ?? null,
        delivery_status: input.deliveryStatus ?? 'sent',
        delivered_at: new Date().toISOString(),
        delivered_by: userId,
        metadata: input.metadata ?? null,
      })
      .select(
        'id, result_card_id, recipient_type, recipient_id, recipient_contact, delivery_method, delivery_status, delivered_at, delivered_by, opened_at, metadata, created_at',
      )
      .single();
    throwIfDbError(error);
    if (!data) throw new BadRequestException('Failed to record delivery');
    return data as Record<string, unknown>;
  }

  private static readonly BULK_MAX_STUDENTS = 60;

  /**
   * Returns a zip stream of result card PDFs for all students in the class section.
   * One class-section batch + one Chromium for the whole ZIP (Nano / Nest safe). Max 60 students.
   */
  async getBulkResultCardPdfStream(
    classSectionId: string,
    branchId: string,
    academicYearId: string | undefined,
    resultType: ResultType,
    pdfVariant?: 'minimal' | 'modern',
  ): Promise<archiver.Archiver> {
    const batch = await this.getResultsForClassSection(
      classSectionId,
      branchId,
      academicYearId,
      resultType,
      this.resolveAssessmentScope('term_report', resultType),
    );
    if (batch.students.length > ResultsService.BULK_MAX_STUDENTS) {
      throw new BadRequestException(
        `Maximum ${ResultsService.BULK_MAX_STUDENTS} students per bulk download. This section has ${batch.students.length}.`,
      );
    }

    const yearId = batch.academicYearId;
    const ranks = this.ranksFromClassBatch(batch.students);
    const className = batch.className;
    const sectionName = batch.sectionName;
    const classLabel = `${className} - ${sectionName}`.trim() || '—';

    const settingsPdf = (await this.resultReportSettingsService.get(branchId)).data.pdfVariant;
    const effectiveVariant: 'minimal' | 'modern' =
      pdfVariant === 'minimal' || pdfVariant === 'modern'
        ? pdfVariant
        : settingsPdf === 'minimal' || settingsPdf === 'modern'
          ? settingsPdf
          : 'modern';
    const pdfPrimaryHex = await this.getTenantPdfPrimaryHex(branchId);
    const pdfThemeCss = buildPdfThemeVariablesCss(pdfPrimaryHex);
    const supabase = this.supabaseConfig.getClient();
    const [{ line1: schoolLine1, line2: schoolLine2 }, ayRow] = await Promise.all([
      this.getReportSchoolLines(branchId),
      supabase.from('academic_years').select('name').eq('id', yearId).maybeSingle().then((r) => r.data),
    ]);
    const academicYearName = (ayRow as { name?: string } | null)?.name?.trim() || '—';

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const pdfs: { name: string; buffer: Buffer }[] = [];
    try {
      for (const s of batch.students) {
        const classTeacherComment = await this.getResultCardComment(
          s.studentId,
          classSectionId,
          branchId,
          yearId,
          resultType,
          'term_report',
        );
        const html = this.composeBasicResultCardHtml({
          result: s,
          classRank: ranks.get(s.studentId),
          className,
          sectionName,
          classLabel,
          schoolLine1,
          schoolLine2,
          academicYearName,
          resultType,
          reportKind: 'term_report',
          effectiveVariant,
          pdfThemeCss,
          classTeacherComment,
        });
        const buffer = await this.printResultCardHtmlToPdf(html, browser);
        const safeName = `${s.studentId}_${(s.studentName || 'student').replace(/[^a-zA-Z0-9-_]/g, '_')}_${resultType}.pdf`;
        pdfs.push({ name: safeName, buffer });
      }
    } finally {
      await browser.close();
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    for (const { name, buffer } of pdfs) {
      archive.append(buffer, { name });
    }
    archive.finalize();
    return archive;
  }
}
