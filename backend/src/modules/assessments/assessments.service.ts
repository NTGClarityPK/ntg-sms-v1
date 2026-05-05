import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ClassSectionsService } from '../class-sections/class-sections.service';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';
import { StaffService } from '../staff/staff.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BranchesService } from '../branches/branches.service';
import { StorageService } from '../storage/storage.service';
import { extractUsernameFromEmail } from '../../common/utils/audit.utils';
import { AssessmentDto } from './dto/assessment.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import {
  AssessmentPublishStatus,
  QueryAssessmentsDto,
} from './dto/query-assessments.dto';
import { QueryExaminationScheduleDto } from './dto/query-examination-schedule.dto';
import { AssessmentStatisticsDto } from './dto/assessment-statistics.dto';
import { ClassStatisticsDto } from './dto/class-statistics.dto';
import { SubjectStatisticsDto } from './dto/subject-statistics.dto';
import { StudentPerformanceDto } from './dto/student-performance.dto';
import { AssessmentStudentStatusDto } from './dto/assessment-student-status.dto';
import { StudentAssessmentStatusDto } from './dto/student-assessment-status.dto';
import { UpdateStudentAssessmentStatusDto } from './dto/update-student-assessment-status.dto';
import { AssessmentAttachmentDto } from './dto/assessment-attachment.dto';
import { CreateAssessmentAttachmentDto } from './dto/create-assessment-attachment.dto';
import { PdfLogoCacheService } from '../../common/pdf/pdf-logo-cache.service';
import { buildPdfFooterTemplate, buildPdfHeaderTemplate } from '../../common/pdf/pdf-templates';
import puppeteer from 'puppeteer';

type Meta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type AssessmentRow = {
  id: string;
  title: string;
  description: string | null;
  assessment_type_id: string;
  subject_id: string;
  class_section_id: string;
  created_by: string;
  total_marks: string | number;
  due_date: string | null;
  examination_duration_minutes: number | null;
  publish_date: string | null;
  is_published: boolean;
  allow_late_submission: boolean;
  room_number: string | null;
  branch_id: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

type StudentAssessmentStatusRow = {
  assessment_id: string;
  student_id: string;
  status: string;
  is_read: boolean;
  updated_at: string;
};

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

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

/** Clamp term-examination duration to a sensible range (minutes). */
function clampExaminationDurationMinutes(raw: number): number {
  return Math.max(1, Math.min(720, Math.floor(raw)));
}

function formatExaminationDurationForPdf(minutes: number, language: string): string {
  const m = Math.round(minutes);
  if (m < 60) {
    return language === 'ar' ? `${m} دقيقة` : `${m} min`;
  }
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (language === 'ar') {
    return r === 0 ? `${h} ساعة` : `${h} س ${r} د`;
  }
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function renderSyllabusToHtml(input: string | null | undefined): string {
  const raw = (input || '').trim();
  if (!raw) return '—';

  const escape = (t: string) =>
    (t || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const applyInline = (line: string): string => {
    // Escape first, then apply safe inline markup.
    const e = escape(line);
    return e
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **bold**
      .replace(/__(.+?)__/g, '<u>$1</u>') // __underline__
      .replace(/==(.+?)==/g, '<mark>$1</mark>'); // ==highlight==
  };

  const splitInlineOrderedItems = (line: string): string[] => {
    // Support "1) Item A 2) Item B" written on the same line by splitting it
    // into separate ordered-list items for PDF rendering.
    const re = /(^|\s)(\d+[\).\]])\s+/g;
    const matches: { index: number; markerLen: number }[] = [];
    let m: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(line)) !== null) {
      const idx = (m.index ?? 0) + (m[1]?.length ?? 0); // skip leading whitespace group
      const marker = m[2] ?? '';
      matches.push({ index: idx, markerLen: marker.length });
      // Avoid infinite loops on zero-length matches (shouldn't happen, but safe).
      if (re.lastIndex === m.index) re.lastIndex++;
    }

    // Only split if there are at least 2 numbered markers.
    if (matches.length < 2) return [line];

    const out: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i]!.index + matches[i]!.markerLen;
      const end = i + 1 < matches.length ? matches[i + 1]!.index : line.length;
      const item = line.slice(start, end).trim();
      if (item) out.push(`1) ${item}`);
    }
    return out.length > 0 ? out : [line];
  };

  const lines = raw
    .split(/\r?\n/)
    .flatMap((l) => splitInlineOrderedItems(l.trim()))
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return '—';

  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(/^[-*]\s+(.+)$/);
        if (!m) break;
        items.push(`<li>${applyInline(m[1]!)}</li>`);
        i++;
      }
      out.push(`<ul style="margin:0; padding-left:16px;">${items.join('')}</ul>`);
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)[\).\]]\s+(.+)$/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(/^\s*\d+[\).\]]\s+(.+)$/);
        if (!m) break;
        items.push(`<li>${applyInline(m[1]!)}</li>`);
        i++;
      }
      out.push(`<ol style="margin:0; padding-left:18px;">${items.join('')}</ol>`);
      continue;
    }

    // Paragraph
    out.push(`<p style="margin:0 0 6px 0;">${applyInline(line)}</p>`);
    i++;
  }

  return out.join('');
}

function mapAssessment(row: AssessmentRow): AssessmentDto {
  return new AssessmentDto({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    assessmentTypeId: row.assessment_type_id,
    subjectId: row.subject_id,
    classSectionId: row.class_section_id,
    createdBy: row.created_by,
    totalMarks: toNumber(row.total_marks),
    dueDate: row.due_date ?? undefined,
    publishDate: row.publish_date ?? undefined,
    isPublished: row.is_published,
    allowLateSubmission: row.allow_late_submission,
    roomNumber: row.room_number?.trim() ? row.room_number.trim() : undefined,
    examinationDurationMinutes:
      row.examination_duration_minutes != null &&
      !Number.isNaN(Number(row.examination_duration_minutes))
        ? Number(row.examination_duration_minutes)
        : undefined,
    branchId: row.branch_id,
    academicYearId: row.academic_year_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapAssessmentWithLookups(
  row: AssessmentRow,
  lookups: {
    subjectNameById?: Map<string, string>;
    teacherNameByUserId?: Map<string, string>;
    classSectionNameById?: Map<string, string>;
  },
): AssessmentDto {
  const base = mapAssessment(row);
  const subjectName = lookups.subjectNameById?.get(base.subjectId);
  const teacherName = lookups.teacherNameByUserId?.get(base.createdBy);
  const classSectionName = lookups.classSectionNameById?.get(base.classSectionId);
  return new AssessmentDto({
    ...base,
    subjectName: subjectName ?? undefined,
    teacherName: teacherName ?? undefined,
    classSectionName: classSectionName ?? undefined,
  });
}

function mapStudentStatusRow(
  row: StudentAssessmentStatusRow,
): StudentAssessmentStatusDto {
  return new StudentAssessmentStatusDto({
    assessmentId: row.assessment_id,
    studentId: row.student_id,
    status: row.status as StudentAssessmentStatusDto['status'],
    isRead: row.is_read,
    updatedAt: row.updated_at,
  });
}

type DraftFileRow = {
  id: string;
  draft_id: string;
  branch_id: string;
  created_by: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string | null;
};

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly classSectionsService: ClassSectionsService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly staffService: StaffService,
    private readonly notificationsService: NotificationsService,
    private readonly branchesService: BranchesService,
    private readonly storageService: StorageService,
    private readonly pdfLogoCache: PdfLogoCacheService,
  ) {}

  private async notifyAssessmentPublished(params: {
    assessmentId: string;
    assessmentTitle: string;
    classSectionId: string;
    academicYearId: string;
    branchId: string;
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const classSection = await this.classSectionsService.getClassSectionById(
      params.classSectionId,
      params.branchId,
    );

    // Active students for this class/section/year via enrolments.
    const { data: enrolments, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', classSection.classId)
      .eq('section_id', classSection.sectionId)
      .eq('branch_id', params.branchId)
      .eq('academic_year_id', params.academicYearId)
      .eq('status', 'active');
    throwIfDbError(enrolErr);

    const studentIds = (enrolments ?? [])
      .map((e) => (e as { student_id?: string }).student_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (studentIds.length === 0) return;

    const { data: students, error: studentsErr } = await supabase
      .from('students')
      .select('id, user_id')
      .in('id', studentIds)
      .eq('branch_id', params.branchId)
      .eq('is_active', true);
    throwIfDbError(studentsErr);

    const studentUserIds = (students ?? [])
      .map((s) => (s as { user_id?: string | null }).user_id ?? null)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    // Parent recipients for these students (if any).
    const { data: parentLinks, error: parentErr } = await supabase
      .from('parent_students')
      .select('parent_user_id, student_id')
      .in('student_id', studentIds);
    throwIfDbError(parentErr);

    const parentUserIds = (parentLinks ?? [])
      .map((p) => (p as { parent_user_id?: string | null }).parent_user_id ?? null)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const recipientUserIds = Array.from(
      new Set<string>([...studentUserIds, ...parentUserIds]),
    );
    if (recipientUserIds.length === 0) return;

    const title = 'New assessment published';
    const body = `A new assessment "${params.assessmentTitle}" has been published.`;
    const type = 'assessment_published';

    // Create one in-app notification per recipient; NotificationsService will also trigger push (if configured).
    await Promise.allSettled(
      recipientUserIds.map((userId) =>
        this.notificationsService.createNotification({
          userId,
          type,
          title,
          body,
          data: {
            assessmentId: params.assessmentId,
            classSectionId: params.classSectionId,
          },
        }),
      ),
    );
  }

  async listAssessments(
    query: QueryAssessmentsDto,
    branchId: string,
    academicYearId?: string,
    currentUserId?: string,
    currentUserRoles?: string[],
    examinationScheduleOnly = false,
  ): Promise<{ data: AssessmentDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? (examinationScheduleOnly ? 'due_date' : 'created_at');
    const sortOrder = query.sortOrder ?? (examinationScheduleOnly ? 'asc' : 'desc');

    let yearId = academicYearId;
    if (!yearId) {
      const activeYear = await this.academicYearsService.getActiveForBranch(
        branchId,
      );
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      yearId = activeYear.id;
    }

    const roles = (currentUserRoles || []).map((r) => String(r).toLowerCase());
    const isAdmin = roles.includes('school_admin');
    const isClassTeacher = roles.includes('class_teacher');
    const isSubjectTeacher = roles.includes('subject_teacher');
    let roleScopeClassSectionId: string | null = null;
    let roleScopePairs: Array<{ classSectionId: string; subjectId: string }> = [];
    let studentTemplateSubjectIds: string[] | null = null;

    if (currentUserId && !isAdmin) {
      if (roles.includes('student')) {
        const { data: student, error: studentError } = await supabase
          .from('students')
          .select('id, class_id, section_id, academic_year_id')
          .eq('user_id', currentUserId)
          .eq('branch_id', branchId)
          .eq('is_active', true)
          .maybeSingle();
        throwIfDbError(studentError);
        if (!student) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 1 },
          };
        }
        const s = student as { class_id: string; section_id: string; academic_year_id: string };
        const { data: classSection, error: csError } = await supabase
          .from('class_sections')
          .select('id')
          .eq('class_id', s.class_id)
          .eq('section_id', s.section_id)
          .eq('academic_year_id', s.academic_year_id)
          .eq('branch_id', branchId)
          .maybeSingle();
        throwIfDbError(csError);
        if (!classSection) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 1 },
          };
        }
        roleScopeClassSectionId = (classSection as { id: string }).id;

        // Subject-template gating (only when student has an assigned template).
        // Applied later for examination schedule view.
        const studentRow = student as { id?: string; academic_year_id?: string };
        const studentId = studentRow?.id ?? null;
        const studentYearId = studentRow?.academic_year_id ?? null;
        if (studentId && studentYearId) {
          const { data: studentTemplate, error: templateError } = await supabase
            .from('student_subject_template_assignments')
            .select('subject_template_id')
            .eq('student_id', studentId)
            .eq('academic_year_id', studentYearId)
            .eq('branch_id', branchId)
            .maybeSingle();
          throwIfDbError(templateError);
          const studentTemplateId = studentTemplate?.subject_template_id || null;
          if (studentTemplateId) {
            const { data: templateSubjects, error: tsError } = await supabase
              .from('subject_template_subjects')
              .select('subject_id')
              .eq('subject_template_id', studentTemplateId);
            throwIfDbError(tsError);
            const ids = (templateSubjects || [])
              .map((ts: { subject_id: string }) => ts.subject_id)
              .filter((id): id is string => typeof id === 'string' && id.length > 0);
            studentTemplateSubjectIds = ids.length > 0 ? ids : [];
          }
        }
      } else if (isSubjectTeacher && !isClassTeacher) {
        // Subject teachers should only see assessments for subjects/class-sections they are assigned to.
        const staff = await this.staffService.getStaffByUserId(
          currentUserId,
          branchId,
        );
        if (!staff) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 1 },
          };
        }
        const { data: assignments, error: taError } = await supabase
          .from('teacher_assignments')
          .select('class_section_id, subject_id')
          .eq('staff_id', staff.id)
          .eq('branch_id', branchId)
          .eq('academic_year_id', yearId);
        throwIfDbError(taError);
        const pairs = (assignments ?? []) as Array<{
          class_section_id: string;
          subject_id: string;
        }>;
        if (pairs.length === 0) {
          return {
            data: [],
            meta: { total: 0, page, limit, totalPages: 1 },
          };
        }
        roleScopePairs = pairs.map((p) => ({
          classSectionId: p.class_section_id,
          subjectId: p.subject_id,
        }));
      }
    }

    // Special case: Examination schedule is a read-only published view.
    // If a subject teacher selects a class section they are assigned to, show the full schedule
    // for that class section (all subjects) rather than only their subject assignments.
    if (
      examinationScheduleOnly &&
      query.classSectionId &&
      roleScopePairs.length > 0 &&
      !isAdmin
    ) {
      const hasAnyAssignmentForClassSection = roleScopePairs.some(
        (p) => p.classSectionId === query.classSectionId,
      );
      if (hasAnyAssignmentForClassSection) {
        roleScopePairs = [];
        roleScopeClassSectionId = query.classSectionId;
      }
    }

    let dbQuery = supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (roleScopeClassSectionId !== null) {
      dbQuery = dbQuery.eq('class_section_id', roleScopeClassSectionId);
    } else if (roleScopePairs.length > 0) {
      const orParts = roleScopePairs.map(
        (p) =>
          `and(class_section_id.eq.${p.classSectionId},subject_id.eq.${p.subjectId})`,
      );
      dbQuery = dbQuery.or(orParts.join(','));
    }

    if (examinationScheduleOnly) {
      const { data: termTypes, error: ttErr } = await supabase
        .from('assessment_types')
        .select('id')
        .eq('branch_id', branchId)
        .eq('is_term_examination', true);
      throwIfDbError(ttErr);
      const termIds = ((termTypes ?? []) as Array<{ id: string }>)
        .map((r) => r.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (termIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 1 },
        };
      }
      dbQuery = dbQuery.in('assessment_type_id', termIds).eq('is_published', true);
    }

    // If a student has an assigned subject template, only show examination schedule
    // items within that template. Students without template keep seeing full schedule.
    if (examinationScheduleOnly && studentTemplateSubjectIds !== null) {
      if (studentTemplateSubjectIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 1 },
        };
      }
      dbQuery = dbQuery.in('subject_id', studentTemplateSubjectIds);
    }

    if (query.classSectionId) {
      dbQuery = dbQuery.eq('class_section_id', query.classSectionId);
    }

    if (query.subjectId) {
      dbQuery = dbQuery.eq('subject_id', query.subjectId);
    }

    if (!examinationScheduleOnly && query.assessmentTypeId) {
      dbQuery = dbQuery.eq('assessment_type_id', query.assessmentTypeId);
    }

    if (query.status && query.status !== 'all') {
      const isPublished = query.status === 'published';
      dbQuery = dbQuery.eq('is_published', isPublished);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte('due_date', query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte('due_date', query.endDate);
    }

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const rows = (data as AssessmentRow[]) ?? [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Hydrate list rows with subject + teacher names (same info shown on My Assessments).
    const subjectIds = Array.from(new Set(rows.map((r) => r.subject_id).filter(Boolean)));
    const teacherUserIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean)));
    const classSectionIds = Array.from(new Set(rows.map((r) => r.class_section_id).filter(Boolean)));

    const [subjectsRes, profilesRes, classSectionsRes] = await Promise.all([
      subjectIds.length > 0
        ? supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds)
            .eq('branch_id', branchId)
        : Promise.resolve({ data: [], error: null } as unknown as { data: any[]; error: PostgrestError | null }),
      teacherUserIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', teacherUserIds)
        : Promise.resolve({ data: [], error: null } as unknown as { data: any[]; error: PostgrestError | null }),
      classSectionIds.length > 0
        ? supabase
            .from('class_sections')
            .select('id, class_id, section_id, classes:class_id(name, display_name), sections:section_id(name)')
            .in('id', classSectionIds)
            .eq('branch_id', branchId)
        : Promise.resolve({ data: [], error: null } as unknown as { data: any[]; error: PostgrestError | null }),
    ]);
    throwIfDbError(subjectsRes.error);
    throwIfDbError(profilesRes.error);
    throwIfDbError(classSectionsRes.error);

    const subjectNameById = new Map<string, string>();
    for (const s of (subjectsRes.data || []) as Array<{ id: string; name: string }>) {
      if (s?.id && s?.name) subjectNameById.set(s.id, s.name);
    }
    const teacherNameByUserId = new Map<string, string>();
    for (const p of (profilesRes.data || []) as Array<{ id: string; full_name: string }>) {
      if (p?.id && p?.full_name) teacherNameByUserId.set(p.id, p.full_name);
    }
    const classSectionNameById = new Map<string, string>();
    for (const row of (classSectionsRes.data || []) as Array<{
      id: string;
      classes?: { name?: string | null; display_name?: string | null } | Array<{ name?: string | null; display_name?: string | null }> | null;
      sections?: { name?: string | null } | Array<{ name?: string | null }> | null;
    }>) {
      const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
      const sectionData = Array.isArray(row.sections) ? row.sections[0] : row.sections;
      const classLabel = (classData?.display_name ?? classData?.name ?? '').trim();
      const sectionLabel = (sectionData?.name ?? '').trim();
      const label = [classLabel, sectionLabel].filter(Boolean).join(' - ').trim();
      if (row.id && label) classSectionNameById.set(row.id, label);
    }

    return {
      data: rows.map((row) =>
        mapAssessmentWithLookups(row, { subjectNameById, teacherNameByUserId, classSectionNameById }),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async createAssessment(
    input: CreateAssessmentDto,
    branchId: string,
    tenantId: string | null,
    createdByUserId: string,
    userEmail: string,
  ): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const MATERIALS_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB total for materials
    if (input.draftId) {
      const draftTotal = await this.getDraftTotalSizeBytes(input.draftId, branchId);
      if (draftTotal > MATERIALS_LIMIT_BYTES) {
        throw new BadRequestException(
          'Total size of materials exceeds 10MB limit. Please remove some files or use smaller files.',
        );
      }
    }

    // Determine which mode we're using
    let classSectionIdsToCreate: string[] = [];
    let academicYearId: string;

    if (input.classSectionId) {
      // Mode 1: Single class-section (existing, backward compatible)
      const classSection = await this.classSectionsService.getClassSectionById(
        input.classSectionId,
        branchId,
      );
      academicYearId = classSection.academicYearId;
      classSectionIdsToCreate = [input.classSectionId];
    } else if (input.classId) {
      // Mode 2 or 3: Class-level creation
      // Get active academic year
      const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
      if (!activeYear) {
        throw new BadRequestException('No active academic year found');
      }
      academicYearId = activeYear.id;

      if (input.subjectTemplateId) {
        // Mode 2: Class + Subject Template - get all sections for this class
        const { data: classSectionsData, error: csError } = await supabase
          .from('class_sections')
          .select('id')
          .eq('branch_id', branchId)
          .eq('academic_year_id', academicYearId)
          .eq('class_id', input.classId)
          .eq('is_active', true);
        throwIfDbError(csError);
        if (!classSectionsData || classSectionsData.length === 0) {
          throw new BadRequestException('No active class sections found for this class');
        }
        classSectionIdsToCreate = classSectionsData.map((cs) => cs.id);

        // Validate subject template exists and subject belongs to it
        const { data: templateSubjects, error: templateError } = await supabase
          .from('subject_template_subjects')
          .select('subject_id')
          .eq('subject_template_id', input.subjectTemplateId);
        throwIfDbError(templateError);
        const templateSubjectIds = (templateSubjects || []).map((ts) => ts.subject_id);
        if (!templateSubjectIds.includes(input.subjectId)) {
          throw new BadRequestException(
            'Selected subject does not belong to the selected subject template',
          );
        }
      } else if (input.classSectionIds && input.classSectionIds.length > 0) {
        // Mode 3: Class + Specific Sections
        // Validate all class-section IDs belong to the class and branch
        const { data: classSectionsData, error: csError } = await supabase
          .from('class_sections')
          .select('id, class_id')
          .in('id', input.classSectionIds)
          .eq('branch_id', branchId)
          .eq('academic_year_id', academicYearId);
        throwIfDbError(csError);
        if (!classSectionsData || classSectionsData.length !== input.classSectionIds.length) {
          throw new BadRequestException('One or more class sections not found');
        }
        // Verify all sections belong to the specified class
        const invalidSections = classSectionsData.filter((cs) => cs.class_id !== input.classId);
        if (invalidSections.length > 0) {
          throw new BadRequestException('One or more class sections do not belong to the specified class');
        }
        classSectionIdsToCreate = input.classSectionIds;
      } else {
        throw new BadRequestException(
          'Either subjectTemplateId or classSectionIds must be provided when classId is specified',
        );
      }
    } else {
      throw new BadRequestException('Either classSectionId or classId must be provided');
    }

    await this.academicYearsService.assertNotLockedForBranch(branchId, academicYearId);

    // If creator is a teacher (has staff record), restrict to their assigned class-sections and subjects only
    const staff = await this.staffService.getStaffByUserId(createdByUserId, branchId);
    if (staff) {
      const { data: assignments } = await this.teacherAssignmentsService.getAssignmentsByTeacher(
        staff.id,
        branchId,
        academicYearId,
      );
      const allowedPairs = new Set(
        (assignments || []).map((a) => `${a.subjectId}:${a.classSectionId}`),
      );
      for (const classSectionId of classSectionIdsToCreate) {
        const key = `${input.subjectId}:${classSectionId}`;
        if (!allowedPairs.has(key)) {
          throw new ForbiddenException(
            'You can only create assessments for class-sections and subjects you are assigned to.',
          );
        }
      }
    }

    // Ensure assessment type exists for branch
    const { data: typeRow, error: typeError } = await supabase
      .from('assessment_types')
      .select('id, is_term_examination')
      .eq('id', input.assessmentTypeId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(typeError);
    if (!typeRow) {
      throw new BadRequestException('Assessment type not found for branch');
    }
    const isTermType = !!(typeRow as { is_term_examination?: boolean }).is_term_examination;
    const roomNumberResolved =
      isTermType && input.roomNumber?.trim()
        ? input.roomNumber.trim().slice(0, 50)
        : null;

    let examinationDurationMinutesResolved: number | null = null;
    if (isTermType) {
      const hasStart = !!input.dueDate;
      const hasDur =
        input.examinationDurationMinutes != null &&
        input.examinationDurationMinutes >= 1;
      if (hasStart !== hasDur) {
        throw new BadRequestException(
          'Term examinations require both a start date and time and a duration in minutes, or omit both for drafts.',
        );
      }
      if (hasStart && hasDur) {
        examinationDurationMinutesResolved = clampExaminationDurationMinutes(
          input.examinationDurationMinutes as number,
        );
      }
    }

    const allowLateResolved = isTermType ? false : (input.allowLateSubmission ?? false);

    // Ensure subject exists (subjects are branch- or tenant-scoped)
    const { data: subjectRow, error: subjectError } = await supabase
      .from('subjects')
      .select('id')
      .eq('id', input.subjectId)
      .maybeSingle();
    throwIfDbError(subjectError);
    if (!subjectRow) {
      throw new BadRequestException('Subject not found');
    }

    // Create assessments for each class-section (created_by/updated_by are user UUIDs)
    const assessmentsToInsert = classSectionIdsToCreate.map((classSectionId) => ({
      title: input.title,
      description: input.description ?? null,
      assessment_type_id: input.assessmentTypeId,
      subject_id: input.subjectId,
      class_section_id: classSectionId,
      created_by: createdByUserId,
      updated_by: createdByUserId,
      total_marks: input.totalMarks,
      due_date: input.dueDate ?? null,
      examination_duration_minutes: examinationDurationMinutesResolved,
      publish_date: input.publishDate ?? null,
      is_published: input.isPublished ?? false,
      allow_late_submission: allowLateResolved,
      room_number: roomNumberResolved,
      branch_id: branchId,
      academic_year_id: academicYearId,
    }));

    const { data, error } = await supabase
      .from('assessments')
      .insert(assessmentsToInsert)
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
      );
    throwIfDbError(error);

    if (!data || data.length === 0) {
      throw new BadRequestException('Failed to create assessments');
    }

    for (const row of data as AssessmentRow[]) {
      this.auditLogService
        .logCreate('assessments', row.id, userEmail, { ...row } as Record<string, unknown>, {
          branchId,
          tenantId,
        })
        .catch(() => {});
    }

    // If assessment is created as published, notify recipients immediately.
    for (const row of data as AssessmentRow[]) {
      if (row.is_published) {
        this.notifyAssessmentPublished({
          assessmentId: row.id,
          assessmentTitle: row.title,
          classSectionId: row.class_section_id,
          academicYearId: row.academic_year_id,
          branchId,
        }).catch(() => {});
      }
    }

    const firstAssessmentId = (data[0] as AssessmentRow).id;
    if (input.draftId) {
      await this.commitDraftToAssessment(
        input.draftId,
        firstAssessmentId,
        branchId,
        createdByUserId,
        userEmail,
      );
    }

    return mapAssessment(data[0] as AssessmentRow);
  }

  async updateAssessment(
    id: string,
    input: UpdateAssessmentDto,
    branchId: string,
    updatedByUserId: string,
    userEmail: string,
  ): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at, updated_by',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }
    await this.academicYearsService.assertNotLockedForBranch(
      branchId,
      (existing as AssessmentRow).academic_year_id,
    );

    const payload: Record<string, unknown> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined)
      payload.description = input.description ?? null;
    if (input.assessmentTypeId !== undefined)
      payload.assessment_type_id = input.assessmentTypeId;
    if (input.subjectId !== undefined) payload.subject_id = input.subjectId;
    if (input.classSectionId !== undefined)
      payload.class_section_id = input.classSectionId;
    if (input.totalMarks !== undefined)
      payload.total_marks = input.totalMarks;
    if (input.dueDate !== undefined) payload.due_date = input.dueDate ?? null;
    if (input.publishDate !== undefined)
      payload.publish_date = input.publishDate ?? null;
    if (input.isPublished !== undefined)
      payload.is_published = input.isPublished;
    payload.updated_by = updatedByUserId;

    const ex = existing as AssessmentRow;
    const nextTypeId =
      input.assessmentTypeId !== undefined ? input.assessmentTypeId : ex.assessment_type_id;

    const { data: typeForTerm, error: trErr } = await supabase
      .from('assessment_types')
      .select('is_term_examination')
      .eq('id', nextTypeId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(trErr);
    const isTerm = !!(typeForTerm as { is_term_examination?: boolean })?.is_term_examination;

    if (!isTerm) {
      payload.room_number = null;
      payload.examination_duration_minutes = null;
      if (input.allowLateSubmission !== undefined)
        payload.allow_late_submission = input.allowLateSubmission;
    } else {
      payload.allow_late_submission = false;
      if (input.roomNumber !== undefined) {
        payload.room_number = input.roomNumber?.trim()
          ? input.roomNumber.trim().slice(0, 50)
          : null;
      }
      if (input.examinationDurationMinutes !== undefined) {
        if (
          input.examinationDurationMinutes !== null &&
          input.examinationDurationMinutes >= 1
        ) {
          payload.examination_duration_minutes = clampExaminationDurationMinutes(
            input.examinationDurationMinutes,
          );
        } else {
          payload.examination_duration_minutes = null;
        }
      }
    }

    const nextDue =
      input.dueDate !== undefined ? (input.dueDate ?? null) : ex.due_date;
    const nextDur =
      input.examinationDurationMinutes !== undefined
        ? input.examinationDurationMinutes !== null &&
          input.examinationDurationMinutes >= 1
          ? clampExaminationDurationMinutes(input.examinationDurationMinutes)
          : null
        : ex.examination_duration_minutes != null
          ? Number(ex.examination_duration_minutes)
          : null;
    if (isTerm) {
      const hasStart = !!nextDue;
      const hasDur = nextDur !== null && nextDur >= 1;
      if (hasStart !== hasDur) {
        throw new BadRequestException(
          'Term examinations require both a start date and time and a duration in minutes, or omit both for drafts.',
        );
      }
    }

    const { data, error } = await supabase
      .from('assessments')
      .update(payload)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);

    const newRow = data as AssessmentRow;
    const changedFields = Object.keys(payload).filter((k) => k !== 'updated_by');
    this.auditLogService
      .logUpdate(
        'assessments',
        id,
        userEmail,
        { ...existing } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        changedFields,
        { branchId },
      )
      .catch(() => {});
    return mapAssessment(newRow);
  }

  async deleteAssessment(
    id: string,
    branchId: string,
    userEmail: string,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow, error: existingError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!oldRow) {
      throw new NotFoundException('Assessment not found');
    }
    await this.academicYearsService.assertNotLockedForBranch(
      branchId,
      (oldRow as AssessmentRow).academic_year_id,
    );

    const { count, error: gradesError } = await supabase
      .from('student_grades')
      .select('id', { head: true, count: 'exact' })
      .eq('assessment_id', id);
    throwIfDbError(gradesError);
    if ((count ?? 0) > 0) {
      throw new BadRequestException(
        'Cannot delete assessment with existing grades',
      );
    }

    const { error } = await supabase
      .from('assessments')
      .delete()
      .eq('id', id)
      .eq('branch_id', branchId);
    throwIfDbError(error);

    this.auditLogService
      .logDelete('assessments', id, userEmail, { ...oldRow } as Record<string, unknown>, {
        branchId,
      })
      .catch(() => {});
    return { id };
  }

  async getAssessmentById(id: string, branchId: string): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Assessment not found');
    }

    const row = data as AssessmentRow;

    const [subjectRes, profileRes] = await Promise.all([
      supabase
        .from('subjects')
        .select('id, name')
        .eq('id', row.subject_id)
        .eq('branch_id', branchId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', row.created_by)
        .maybeSingle(),
    ]);

    const subjectNameById = new Map<string, string>();
    if (!subjectRes.error && subjectRes.data?.id && (subjectRes.data as any)?.name) {
      subjectNameById.set(subjectRes.data.id as any, (subjectRes.data as any).name as any);
    }
    const teacherNameByUserId = new Map<string, string>();
    if (!profileRes.error && profileRes.data?.id && (profileRes.data as any)?.full_name) {
      teacherNameByUserId.set(profileRes.data.id as any, (profileRes.data as any).full_name as any);
    }

    return mapAssessmentWithLookups(row, { subjectNameById, teacherNameByUserId });
  }

  async publishAssessment(
    id: string,
    branchId: string,
    publishDate?: string,
  ): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('assessments')
      .update({
        is_published: true,
        publish_date: publishDate ?? new Date().toISOString().slice(0, 10),
      })
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
      )
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Assessment not found');
    }

    // Notify students + linked parents that the assessment is now published.
    this.notifyAssessmentPublished({
      assessmentId: (data as AssessmentRow).id,
      assessmentTitle: (data as AssessmentRow).title,
      classSectionId: (data as AssessmentRow).class_section_id,
      academicYearId: (data as AssessmentRow).academic_year_id,
      branchId,
    }).catch(() => {});

    return mapAssessment(data as AssessmentRow);
  }

  /**
   * Get statistics for a specific assessment
   */
  async getAssessmentStatistics(
    assessmentId: string,
    branchId: string,
  ): Promise<AssessmentStatisticsDto> {
    const supabase = this.supabaseConfig.getClient();

    // Get assessment details
    const { data: assessment, error: aError } = await supabase
      .from('assessments')
      .select('id, title, class_section_id, academic_year_id')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(aError);
    if (!assessment) {
      throw new NotFoundException('Assessment not found.');
    }

    // Get class section details to get class_id and section_id
    const classSection = await this.classSectionsService.getClassSectionById(
      assessment.class_section_id,
      branchId,
    );

    // Get total students in the class section (year-scoped placement via enrolments)
    const { data: enrolments, count: totalStudents, error: studentsError } = await supabase
      .from('student_enrolments')
      .select('student_id', { count: 'exact' })
      .eq('class_id', classSection.classId)
      .eq('section_id', classSection.sectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academic_year_id)
      .eq('status', 'active');
    throwIfDbError(studentsError);

    const enrolledStudentIds = (enrolments ?? [])
      .map((e) => (e as any).student_id as string | undefined)
      .filter((id): id is string => !!id);

    // If there are no enrolled students for this class/section/year, return safe zeros.
    // This can happen for old assessments where the class has no active enrolments in that academic year.
    if (enrolledStudentIds.length === 0) {
      return new AssessmentStatisticsDto({
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        totalStudents: totalStudents ?? 0,
        gradedCount: 0,
        ungradedCount: 0,
        absentCount: 0,
        excusedCount: 0,
        averageMarks: undefined,
        highestMarks: undefined,
        lowestMarks: undefined,
        submissionRate: 0,
        completionRate: 0,
      });
    }

    // Get grades only for the relevant enrolled students (prevents mixing old-year / withdrawn data)
    const { data: grades, error: gradesError } = await supabase
      .from('student_grades')
      .select('student_id, marks_obtained, submission_status')
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId)
      .in('student_id', enrolledStudentIds);
    throwIfDbError(gradesError);

    // De-duplicate by student_id so one student can't inflate counts
    const latestByStudent = new Map<string, { marks_obtained: string | number; submission_status: string }>();
    for (const g of (grades ?? []) as any[]) {
      const sid = g.student_id as string | undefined;
      if (!sid) continue;
      latestByStudent.set(sid, {
        marks_obtained: (g.marks_obtained as string | number) ?? 0,
        submission_status: String(g.submission_status ?? ''),
      });
    }
    const gradesUnique = Array.from(latestByStudent.values());

    const gradedCount = gradesUnique.length;
    // submission_status: 'not_submitted', 'submitted', 'late', 'excused'
    const absentCount = gradesUnique.filter((g) => g.submission_status === 'not_submitted').length;
    const excusedCount = gradesUnique.filter((g) => g.submission_status === 'excused').length;
    const ungradedCount = Math.max((totalStudents ?? 0) - gradedCount, 0);

    // Calculate statistics for non-absent and non-excused students
    const validGrades = gradesUnique.filter(
      (g) => g.submission_status !== 'not_submitted' && g.submission_status !== 'excused',
    );
    const averageMarks =
      validGrades.length > 0
        ? validGrades.reduce((sum, g) => sum + toNumber(g.marks_obtained), 0) / validGrades.length
        : undefined;
    const highestMarks =
      validGrades.length > 0 ? Math.max(...validGrades.map((g) => toNumber(g.marks_obtained))) : undefined;
    const lowestMarks =
      validGrades.length > 0 ? Math.min(...validGrades.map((g) => toNumber(g.marks_obtained))) : undefined;

    // Submission rate: percentage of students who submitted (excluding absent and excused)
    // This should be: (students who submitted) / (total students)
    // = (gradedCount - absentCount - excusedCount) / totalStudents
    const submittedCount = gradedCount - absentCount - excusedCount;
    const submissionRate = totalStudents ? (submittedCount / totalStudents) * 100 : 0;
    
    // Completion rate: same as submission rate (students who completed/submitted)
    const completionRate = totalStudents ? (submittedCount / totalStudents) * 100 : 0;

    return new AssessmentStatisticsDto({
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      totalStudents: totalStudents ?? 0,
      gradedCount,
      ungradedCount,
      absentCount,
      excusedCount,
      averageMarks,
      highestMarks,
      lowestMarks,
      submissionRate: Math.round(submissionRate * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
    });
  }

  /**
   * Get per-student assessment status for statistics view
   */
  async getAssessmentStudentStatuses(
    assessmentId: string,
    branchId: string,
  ): Promise<AssessmentStudentStatusDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Get assessment details
    const { data: assessment, error: aError } = await supabase
      .from('assessments')
      .select('id, class_section_id, academic_year_id')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(aError);
    if (!assessment) {
      throw new NotFoundException('Assessment not found.');
    }

    // Get class section details
    const classSection = await this.classSectionsService.getClassSectionById(
      assessment.class_section_id,
      branchId,
    );

    // Get all active students in this class/section/year (via enrolments -> students)
    const { data: enrolments, error: enrolErr } = await supabase
      .from('student_enrolments')
      .select('student_id')
      .eq('class_id', classSection.classId)
      .eq('section_id', classSection.sectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academic_year_id)
      .eq('status', 'active');
    throwIfDbError(enrolErr);

    const studentIds = (enrolments || [])
      .map((e: { student_id: string }) => e.student_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (studentIds.length === 0) {
      return [];
    }

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, user_id, student_id, branch_id')
      .in('id', studentIds)
      .eq('branch_id', branchId)
      .eq('is_active', true);
    throwIfDbError(studentsError);
    if (!students || students.length === 0) return [];

    // Fetch statuses for these students for this assessment
    const { data: statuses, error: statusesError } = await supabase
      .from('student_assessment_statuses')
      .select('assessment_id, student_id, status, is_read, updated_at')
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId)
      .in('student_id', studentIds);
    throwIfDbError(statusesError);

    const statusMap = new Map<string, StudentAssessmentStatusDto>();
    for (const row of statuses ?? []) {
      const dto = mapStudentStatusRow(row as StudentAssessmentStatusRow);
      statusMap.set(dto.studentId, dto);
    }

    // Fetch student names from profiles via user_id
    const userIds = (students as any[])
      .map((s) => s.user_id as string | null)
      .filter((id) => !!id) as string[];
    const uniqueUserIds = Array.from(new Set(userIds));

    const profilesMap = new Map<string, string>();
    if (uniqueUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueUserIds);
      throwIfDbError(profilesError);
      for (const p of profiles ?? []) {
        profilesMap.set((p as any).id as string, (p as any).full_name as string);
      }
    }

    return (students as any[]).map((s) => {
      const status = statusMap.get(s.id as string);
      const studentUserId = s.user_id as string | undefined;
      const name = studentUserId ? profilesMap.get(studentUserId) : undefined;

      return new AssessmentStudentStatusDto({
        studentId: s.id as string,
        studentUserId: studentUserId ?? '',
        studentName: name,
        studentStudentId: s.student_id as string | undefined,
        status: status?.status,
        isRead: status?.isRead ?? false,
        updatedAt: status?.updatedAt,
      });
    });
  }

  /**
   * Get statistics for a class section (all assessments)
   */
  async getClassStatistics(classSectionId: string, branchId: string): Promise<ClassStatisticsDto> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found for this branch.');
    }

    // Get class section details
    const classSection = await this.classSectionsService.getClassSectionById(
      classSectionId,
      branchId,
    );
    if (!classSection) {
      throw new NotFoundException('Class section not found.');
    }

    // Get total students in class
    const { count: totalStudents, error: studentsError } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .eq('is_active', true);
    throwIfDbError(studentsError);

    // Get all assessments for this class
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('id, is_published, total_marks')
      .eq('class_section_id', classSectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id);
    throwIfDbError(assessmentsError);

    const totalAssessments = (assessments ?? []).length;
    const publishedAssessments = (assessments ?? []).filter((a) => a.is_published).length;
    const unpublishedAssessments = totalAssessments - publishedAssessments;

    // Get all grades for this class
    const assessmentIds = (assessments ?? []).map((a) => a.id);
    if (assessmentIds.length === 0) {
      return new ClassStatisticsDto({
        classSectionId,
        classSectionName: `${classSection.className} - ${classSection.sectionName}`,
        totalStudents: totalStudents ?? 0,
        totalAssessments: 0,
        publishedAssessments: 0,
        unpublishedAssessments: 0,
        totalGradesEntered: 0,
        totalGradesPending: 0,
      });
    }

    const { data: grades, error: gradesError } = await supabase
      .from('student_grades')
      .select('marks_obtained, is_absent, is_excused, assessment_id')
      .eq('branch_id', branchId)
      .in('assessment_id', assessmentIds);
    throwIfDbError(gradesError);

    const totalGradesEntered = (grades ?? []).length;
    const totalGradesPossible = totalAssessments * (totalStudents ?? 0);
    const totalGradesPending = totalGradesPossible - totalGradesEntered;

    // Calculate overall average marks
    const validGrades = (grades ?? []).filter((g) => !g.is_absent && !g.is_excused);
    const overallAverageMarks =
      validGrades.length > 0
        ? validGrades.reduce((sum, g) => sum + toNumber(g.marks_obtained), 0) / validGrades.length
        : undefined;

    return new ClassStatisticsDto({
      classSectionId,
      classSectionName: `${classSection.className} - ${classSection.sectionName}`,
      totalStudents: totalStudents ?? 0,
      totalAssessments,
      publishedAssessments,
      unpublishedAssessments,
      overallAverageMarks: overallAverageMarks ? Math.round(overallAverageMarks * 100) / 100 : undefined,
      totalGradesEntered,
      totalGradesPending,
    });
  }

  /**
   * Get statistics for a subject (all assessments across all classes)
   */
  async getSubjectStatistics(subjectId: string, branchId: string): Promise<SubjectStatisticsDto> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found for this branch.');
    }

    // Get subject details
    const { data: subject, error: subjectError } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('id', subjectId)
      .maybeSingle();
    throwIfDbError(subjectError);
    if (!subject) {
      throw new NotFoundException('Subject not found.');
    }

    // Get all assessments for this subject
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('id, is_published, total_marks')
      .eq('subject_id', subjectId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id);
    throwIfDbError(assessmentsError);

    const totalAssessments = (assessments ?? []).length;
    const publishedAssessments = (assessments ?? []).filter((a) => a.is_published).length;

    if (totalAssessments === 0) {
      return new SubjectStatisticsDto({
        subjectId,
        subjectName: subject.name,
        totalAssessments: 0,
        publishedAssessments: 0,
      });
    }

    // Get grades for all assessments
    const assessmentIds = (assessments ?? []).map((a) => a.id);
    const { data: grades, error: gradesError } = await supabase
      .from('student_grades')
      .select('marks_obtained, is_absent, is_excused, assessment_id')
      .eq('branch_id', branchId)
      .in('assessment_id', assessmentIds);
    throwIfDbError(gradesError);

    // Calculate average marks per assessment
    const assessmentAverages: number[] = [];
    for (const assessment of assessments ?? []) {
      const assessmentGrades = (grades ?? []).filter(
        (g) => g.assessment_id === assessment.id && !g.is_absent && !g.is_excused,
      );
      if (assessmentGrades.length > 0) {
        const avg = assessmentGrades.reduce((sum, g) => sum + toNumber(g.marks_obtained), 0) / assessmentGrades.length;
        assessmentAverages.push(avg);
      }
    }

    const averageMarksAcrossAssessments =
      assessmentAverages.length > 0
        ? assessmentAverages.reduce((sum, avg) => sum + avg, 0) / assessmentAverages.length
        : undefined;
    const highestAverageMarks = assessmentAverages.length > 0 ? Math.max(...assessmentAverages) : undefined;
    const lowestAverageMarks = assessmentAverages.length > 0 ? Math.min(...assessmentAverages) : undefined;

    return new SubjectStatisticsDto({
      subjectId,
      subjectName: subject.name,
      totalAssessments,
      publishedAssessments,
      averageMarksAcrossAssessments: averageMarksAcrossAssessments
        ? Math.round(averageMarksAcrossAssessments * 100) / 100
        : undefined,
      highestAverageMarks: highestAverageMarks ? Math.round(highestAverageMarks * 100) / 100 : undefined,
      lowestAverageMarks: lowestAverageMarks ? Math.round(lowestAverageMarks * 100) / 100 : undefined,
    });
  }

  /**
   * Get performance summary for a specific student
   */
  async getStudentPerformance(studentId: string, branchId: string): Promise<StudentPerformanceDto> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found for this branch.');
    }

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, class_section_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .maybeSingle();
    throwIfDbError(studentError);
    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    // Get all published assessments for student's class
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select('id, total_marks')
      .eq('class_section_id', student.class_section_id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .eq('is_published', true);
    throwIfDbError(assessmentsError);

    const totalAssessments = (assessments ?? []).length;

    if (totalAssessments === 0) {
      return new StudentPerformanceDto({
        studentId,
        studentName: `${student.first_name} ${student.last_name}`,
        totalAssessments: 0,
        gradedAssessments: 0,
        pendingAssessments: 0,
      });
    }

    // Get student's grades
    const assessmentIds = (assessments ?? []).map((a) => a.id);
    const { data: grades, error: gradesError } = await supabase
      .from('student_grades')
      .select('marks_obtained, is_absent, is_excused, assessment_id')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .in('assessment_id', assessmentIds);
    throwIfDbError(gradesError);

    const gradedAssessments = (grades ?? []).length;
    const pendingAssessments = totalAssessments - gradedAssessments;

    // Calculate performance metrics
    const validGrades = (grades ?? []).filter((g) => !g.is_absent && !g.is_excused);
    const totalMarksObtained =
      validGrades.length > 0 ? validGrades.reduce((sum, g) => sum + toNumber(g.marks_obtained), 0) : undefined;

    // Get total possible marks from assessments that were graded
    const gradedAssessmentIds = new Set((grades ?? []).map((g) => g.assessment_id));
    const totalPossibleMarks =
      (assessments ?? [])
        .filter((a) => gradedAssessmentIds.has(a.id))
        .reduce((sum, a) => sum + toNumber(a.total_marks), 0) || undefined;

    const averageMarks = validGrades.length > 0 ? totalMarksObtained! / validGrades.length : undefined;
    const percentageScore =
      totalMarksObtained !== undefined && totalPossibleMarks && totalPossibleMarks > 0
        ? (totalMarksObtained / totalPossibleMarks) * 100
        : undefined;

    return new StudentPerformanceDto({
      studentId,
      studentName: `${student.first_name} ${student.last_name}`,
      totalAssessments,
      gradedAssessments,
      pendingAssessments,
      averageMarks: averageMarks ? Math.round(averageMarks * 100) / 100 : undefined,
      totalMarksObtained,
      totalPossibleMarks,
      percentageScore: percentageScore ? Math.round(percentageScore * 100) / 100 : undefined,
    });
  }

  /**
   * Get published assessments for the current student in their class
   */
  async getMyAssessmentsForCurrentStudent(
    userId: string,
    branchId: string,
  ): Promise<
    Array<{
      assessment: AssessmentDto;
      status?: StudentAssessmentStatusDto;
      attachments: {
        id: string;
        fileName: string;
        fileUrl: string;
        mimeType?: string;
        createdAt: string;
      }[];
    }>
  > {
    const supabase = this.supabaseConfig.getClient();

    // Find student record for this user in the current branch
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, section_id, academic_year_id, branch_id')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    throwIfDbError(studentError);
    if (!student) {
      throw new BadRequestException('No student record found for current user');
    }

    // In some tenants, student records may exist before being fully assigned to a class/section/year.
    // Avoid sending "null" into UUID filters (PostgREST rejects it) and treat as "no assessments yet".
    if (!student.class_id || !student.section_id || !student.academic_year_id) {
      return [];
    }

    // Find class_section for this student's class/section/year
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('class_id', student.class_id)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', student.academic_year_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(csError);
    if (!classSection) {
      // No class section means no assessments
      return [];
    }

    // Get published assessments for this class section
    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
      )
      .eq('class_section_id', classSection.id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', student.academic_year_id)
      .eq('is_published', true)
      .order('due_date', { ascending: true });

    throwIfDbError(assessmentsError);

    const assessmentRows = (assessments ?? []) as AssessmentRow[];
    if (assessmentRows.length === 0) {
      return [];
    }

    // Get student's subject template assignment for this academic year
    const { data: studentTemplate, error: templateError } = await supabase
      .from('student_subject_template_assignments')
      .select('subject_template_id')
      .eq('student_id', student.id)
      .eq('academic_year_id', student.academic_year_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(templateError);
    const studentTemplateId = studentTemplate?.subject_template_id || null;

    // Filter assessments based on subject template
    // If student has a template, only show assessments whose subject is in that template
    // If student has no template, show all assessments (backward compatibility)
    let filteredAssessments = assessmentRows;

    if (studentTemplateId) {
      // Get subjects in the student's template
      const { data: templateSubjects, error: templateSubjectsError } = await supabase
        .from('subject_template_subjects')
        .select('subject_id')
        .eq('subject_template_id', studentTemplateId);

      throwIfDbError(templateSubjectsError);
      const templateSubjectIds = new Set(
        (templateSubjects || []).map((ts: { subject_id: string }) => ts.subject_id),
      );

      // Get all subjects that belong to ANY template (to identify assessments created with template mode)
      const { data: allTemplateSubjects, error: allTemplateSubjectsError } = await supabase
        .from('subject_template_subjects')
        .select('subject_id');

      throwIfDbError(allTemplateSubjectsError);
      const allTemplateSubjectIds = new Set(
        (allTemplateSubjects || []).map((ts: { subject_id: string }) => ts.subject_id),
      );

      // Filter assessments:
      // 1. Show assessments whose subject is in the student's template (created with template mode)
      // 2. Show assessments whose subject doesn't belong to any template (created in single mode, backward compatibility)
      filteredAssessments = assessmentRows.filter((assessment) => {
        const subjectInAnyTemplate = allTemplateSubjectIds.has(assessment.subject_id);
        if (subjectInAnyTemplate) {
          // Subject belongs to a template - only show if it's in student's template
          return templateSubjectIds.has(assessment.subject_id);
        } else {
          // Subject doesn't belong to any template - show to all students (backward compatibility)
          return true;
        }
      });
    }
    // If student has no template, show all assessments (backward compatibility)

    const assessmentIds = filteredAssessments.map((a) => a.id);
    const subjectIds = Array.from(new Set(filteredAssessments.map((a) => a.subject_id)));
    const creatorUserIds = Array.from(
      new Set(filteredAssessments.map((a) => a.created_by).filter((id): id is string => !!id)),
    );

    const [subjectsRes, profilesRes] = await Promise.all([
      subjectIds.length > 0
        ? supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds)
            .eq('branch_id', branchId)
        : Promise.resolve({ data: [], error: null } as any),
      creatorUserIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', creatorUserIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    throwIfDbError(subjectsRes.error ?? null);
    throwIfDbError(profilesRes.error ?? null);

    const subjectNameById = new Map<string, string>();
    for (const s of (subjectsRes.data ?? []) as any[]) {
      if (s?.id && s?.name) subjectNameById.set(s.id, s.name);
    }

    const teacherNameByUserId = new Map<string, string>();
    for (const p of (profilesRes.data ?? []) as any[]) {
      if (p?.id && p?.full_name) teacherNameByUserId.set(p.id, p.full_name);
    }

    // Fetch attachments for these assessments
    const { data: attachments, error: attachmentsError } = await supabase
      .from('assessment_attachments')
      .select('id, assessment_id, file_name, file_url, mime_type, created_at')
      .in('assessment_id', assessmentIds);

    throwIfDbError(attachmentsError);

    const attachmentsByAssessment = new Map<
      string,
      {
        id: string;
        fileName: string;
        fileUrl: string;
        mimeType?: string;
        createdAt: string;
      }[]
    >();

    for (const att of attachments ?? []) {
      const key = (att as any).assessment_id as string;
      const list = attachmentsByAssessment.get(key) ?? [];
      list.push({
        id: (att as any).id,
        fileName: (att as any).file_name,
        fileUrl: (att as any).file_url,
        mimeType: (att as any).mime_type ?? undefined,
        createdAt: (att as any).created_at,
      });
      attachmentsByAssessment.set(key, list);
    }

    // Fetch existing statuses for this student
    const { data: statuses, error: statusesError } = await supabase
      .from('student_assessment_statuses')
      .select('assessment_id, student_id, status, is_read, updated_at')
      .eq('student_id', student.id)
      .eq('branch_id', branchId)
      .in('assessment_id', assessmentIds);

    throwIfDbError(statusesError);
    const statusMap = new Map<string, StudentAssessmentStatusDto>();
    for (const row of statuses ?? []) {
      const dto = mapStudentStatusRow(row as StudentAssessmentStatusRow);
      statusMap.set(dto.assessmentId, dto);
    }

    return filteredAssessments.map((row) => {
      const assessment = mapAssessmentWithLookups(row, { subjectNameById, teacherNameByUserId });
      const status = statusMap.get(assessment.id);
      const att = attachmentsByAssessment.get(assessment.id) ?? [];
      return {
        assessment,
        status,
        attachments: att,
      };
    });
  }

  /**
   * Get assessments for a student identified directly by their student UUID (from custom JWT).
   * Used by StudentSelfController when a parent is acting as a child or a student logs in via PIN.
   */
  async getMyAssessmentsForStudentById(
    studentId: string,
    branchId: string,
  ): Promise<
    Array<{
      assessment: AssessmentDto;
      status?: StudentAssessmentStatusDto;
      attachments: {
        id: string;
        fileName: string;
        fileUrl: string;
        mimeType?: string;
        createdAt: string;
      }[];
    }>
  > {
    const supabase = this.supabaseConfig.getClient();

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, section_id, academic_year_id, branch_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    throwIfDbError(studentError);
    if (!student) {
      throw new BadRequestException('No active student record found');
    }

    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('id')
      .eq('class_id', student.class_id)
      .eq('section_id', student.section_id)
      .eq('academic_year_id', student.academic_year_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(csError);
    if (!classSection) return [];

    const { data: assessments, error: assessmentsError } = await supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, examination_duration_minutes, publish_date, is_published, allow_late_submission, room_number, branch_id, academic_year_id, created_at, updated_at',
      )
      .eq('class_section_id', classSection.id)
      .eq('branch_id', branchId)
      .eq('academic_year_id', student.academic_year_id)
      .eq('is_published', true)
      .order('due_date', { ascending: true });

    throwIfDbError(assessmentsError);

    const assessmentRows = (assessments ?? []) as AssessmentRow[];
    if (assessmentRows.length === 0) return [];

    const { data: studentTemplate, error: templateError } = await supabase
      .from('student_subject_template_assignments')
      .select('subject_template_id')
      .eq('student_id', student.id)
      .eq('academic_year_id', student.academic_year_id)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(templateError);
    const studentTemplateId = studentTemplate?.subject_template_id || null;

    let filteredAssessments = assessmentRows;
    if (studentTemplateId) {
      const { data: templateSubjects, error: tsError } = await supabase
        .from('subject_template_subjects')
        .select('subject_id')
        .eq('subject_template_id', studentTemplateId);

      throwIfDbError(tsError);
      const templateSubjectIds = new Set(
        (templateSubjects || []).map((ts: { subject_id: string }) => ts.subject_id),
      );
      // If the student has an assigned subject template, only show assessments whose subject
      // is included in that template. Students without a template keep seeing the full class schedule.
      filteredAssessments = assessmentRows.filter((assessment) =>
        templateSubjectIds.has(assessment.subject_id),
      );
    }

    const assessmentIds = filteredAssessments.map((a) => a.id);
    const subjectIds = Array.from(new Set(filteredAssessments.map((a) => a.subject_id)));
    const creatorUserIds = Array.from(
      new Set(filteredAssessments.map((a) => a.created_by).filter((id): id is string => !!id)),
    );

    const [subjectsRes, profilesRes] = await Promise.all([
      subjectIds.length > 0
        ? supabase
            .from('subjects')
            .select('id, name')
            .in('id', subjectIds)
            .eq('branch_id', branchId)
        : Promise.resolve({ data: [], error: null } as any),
      creatorUserIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', creatorUserIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    throwIfDbError(subjectsRes.error ?? null);
    throwIfDbError(profilesRes.error ?? null);

    const subjectNameById = new Map<string, string>();
    for (const s of (subjectsRes.data ?? []) as any[]) {
      if (s?.id && s?.name) subjectNameById.set(s.id, s.name);
    }

    const teacherNameByUserId = new Map<string, string>();
    for (const p of (profilesRes.data ?? []) as any[]) {
      if (p?.id && p?.full_name) teacherNameByUserId.set(p.id, p.full_name);
    }

    const { data: attachments, error: attachmentsError } = await supabase
      .from('assessment_attachments')
      .select('id, assessment_id, file_name, file_url, mime_type, created_at')
      .in('assessment_id', assessmentIds);

    throwIfDbError(attachmentsError);

    const attachmentsByAssessment = new Map<
      string,
      { id: string; fileName: string; fileUrl: string; mimeType?: string; createdAt: string }[]
    >();
    for (const att of attachments ?? []) {
      const key = (att as any).assessment_id as string;
      const list = attachmentsByAssessment.get(key) ?? [];
      list.push({
        id: (att as any).id,
        fileName: (att as any).file_name,
        fileUrl: (att as any).file_url,
        mimeType: (att as any).mime_type ?? undefined,
        createdAt: (att as any).created_at,
      });
      attachmentsByAssessment.set(key, list);
    }

    const { data: statuses, error: statusesError } = await supabase
      .from('student_assessment_statuses')
      .select('assessment_id, student_id, status, is_read, updated_at')
      .eq('student_id', student.id)
      .eq('branch_id', branchId)
      .in('assessment_id', assessmentIds);

    throwIfDbError(statusesError);
    const statusMap = new Map<string, StudentAssessmentStatusDto>();
    for (const row of statuses ?? []) {
      const dto = mapStudentStatusRow(row as StudentAssessmentStatusRow);
      statusMap.set(dto.assessmentId, dto);
    }

    return filteredAssessments.map((row) => {
      const assessment = mapAssessmentWithLookups(row, { subjectNameById, teacherNameByUserId });
      return {
        assessment,
        status: statusMap.get(assessment.id),
        attachments: attachmentsByAssessment.get(assessment.id) ?? [],
      };
    });
  }

  async getExaminationScheduleForStudentById(
    studentId: string,
    branchId: string,
  ): Promise<{ data: AssessmentDto[] }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: termTypes, error: ttErr } = await supabase
      .from('assessment_types')
      .select('id')
      .eq('branch_id', branchId)
      .eq('is_term_examination', true);
    throwIfDbError(ttErr);
    const termIds = new Set(
      ((termTypes ?? []) as Array<{ id: string }>).map((t) => t.id).filter(Boolean),
    );
    if (termIds.size === 0) {
      return { data: [] };
    }
    const items = await this.getMyAssessmentsForStudentById(studentId, branchId);
    return {
      data: items
        .filter((item) => termIds.has(item.assessment.assessmentTypeId))
        .map((item) => item.assessment),
    };
  }

  /**
   * Update assessment status for a student identified directly by student UUID (from custom JWT).
   */
  async updateMyAssessmentStatusByStudentId(
    assessmentId: string,
    studentId: string,
    branchId: string,
    dto: UpdateStudentAssessmentStatusDto,
  ): Promise<StudentAssessmentStatusDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, title, class_section_id, academic_year_id, branch_id, created_by')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(assessmentError);
    if (!assessment) throw new NotFoundException('Assessment not found');

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, academic_year_id, branch_id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    throwIfDbError(studentError);
    if (!student) throw new BadRequestException('No active student record found');

    const { data, error } = await supabase
      .from('student_assessment_statuses')
      .upsert(
        {
          assessment_id: assessmentId,
          student_id: student.id,
          branch_id: branchId,
          academic_year_id: assessment.academic_year_id,
          status: dto.status ?? 'in_progress',
          is_read: dto.isRead ?? true,
        },
        { onConflict: 'assessment_id,student_id' },
      )
      .select('assessment_id, student_id, status, is_read, updated_at')
      .single();

    throwIfDbError(error);
    const statusDto = mapStudentStatusRow(data as StudentAssessmentStatusRow);

    if (dto.isRead) {
      await this.notifyAssessmentRead(assessment, student, branchId);
    }

    return statusDto;
  }

  /**
   * Update current student's status for a given assessment
   */
  async updateMyAssessmentStatus(
    assessmentId: string,
    userId: string,
    branchId: string,
    dto: UpdateStudentAssessmentStatusDto,
  ): Promise<StudentAssessmentStatusDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify assessment exists in this branch
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, title, class_section_id, academic_year_id, branch_id, created_by')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();

    throwIfDbError(assessmentError);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Find student record for this user in the current branch
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, user_id, academic_year_id, branch_id')
      .eq('user_id', userId)
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .maybeSingle();

    throwIfDbError(studentError);
    if (!student) {
      throw new BadRequestException('No student record found for current user');
    }

    // Upsert status
    const payload: Partial<StudentAssessmentStatusRow> = {
      assessment_id: assessmentId,
      student_id: student.id,
      status: dto.status ?? 'in_progress',
      is_read: dto.isRead ?? true,
    };

    const { data, error } = await supabase
      .from('student_assessment_statuses')
      .upsert(
        {
          assessment_id: payload.assessment_id,
          student_id: payload.student_id,
          branch_id: branchId,
          academic_year_id: assessment.academic_year_id,
          status: payload.status,
          is_read: payload.is_read,
        },
        {
          // Unique constraint on (assessment_id, student_id)
          onConflict: 'assessment_id,student_id',
        },
      )
      .select('assessment_id, student_id, status, is_read, updated_at')
      .single();

    throwIfDbError(error);
    const statusDto = mapStudentStatusRow(data as StudentAssessmentStatusRow);

    // If explicitly marked as read, notify relevant staff
    if (dto.isRead) {
      await this.notifyAssessmentRead(assessment, student, branchId);
    }

    return statusDto;
  }

  /**
   * Notify school admin(s), class teacher, and assessment creator when a student marks an assessment as read
   */
  private async notifyAssessmentRead(
    assessment: any,
    student: any,
    branchId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const userIds = new Set<string>();

    // 1) Assessment creator
    if (assessment.created_by) {
      userIds.add(assessment.created_by as string);
    }

    // 2) Class teacher for this class section (if any)
    if (assessment.class_section_id) {
      const classSection = await this.classSectionsService.getClassSectionById(
        assessment.class_section_id,
        branchId,
      );

      if (classSection.classTeacherId) {
        const { data: staffRow, error: staffError } = await supabase
          .from('staff')
          .select('user_id')
          .eq('id', classSection.classTeacherId)
          .maybeSingle();

        throwIfDbError(staffError);
        if (staffRow?.user_id) {
          userIds.add(staffRow.user_id as string);
        }
      }
    }

    // 3) School admin(s) for this branch
    const { data: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select('user_id, roles(name)')
      .eq('branch_id', branchId);

    throwIfDbError(adminError);
    for (const ur of adminUsers ?? []) {
      const roleName = (ur as any).roles?.name as string | undefined;
      if (roleName && roleName.toLowerCase() === 'school_admin') {
        userIds.add((ur as any).user_id as string);
      }
    }

    if (userIds.size === 0) {
      return;
    }

    // Optional: get student name for message
    let studentLabel = 'A student';
    if (student?.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', student.user_id)
        .maybeSingle();
      if (!profileError && profile?.full_name) {
        studentLabel = profile.full_name;
      }
    }

    const title = 'Assessment read';
    const body = `${studentLabel} marked the assessment "${assessment.title}" as read.`;

    for (const notifyUserId of userIds) {
      await this.notificationsService.createNotification({
        userId: notifyUserId,
        type: 'assessment_read',
        title,
        body,
        data: {
          assessmentId: assessment.id,
          studentId: student.id,
        },
      });
    }
  }

  /**
   * Sum of attachment sizes for an assessment (for 10MB materials limit).
   */
  async getAssessmentAttachmentsTotalSizeBytes(
    assessmentId: string,
    branchId: string,
  ): Promise<number> {
    const supabase = this.supabaseConfig.getClient();
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (!assessment) return 0;
    const { data: rows, error } = await supabase
      .from('assessment_attachments')
      .select('file_size_bytes')
      .eq('assessment_id', assessmentId);
    throwIfDbError(error);
    const total = (rows ?? []).reduce(
      (sum, r) => sum + (Number(r.file_size_bytes) || 0),
      0,
    );
    return total;
  }

  /**
   * Get draft total size (post-compression) for 10MB check.
   */
  async getDraftTotalSizeBytes(draftId: string, branchId: string): Promise<number> {
    const supabase = this.supabaseConfig.getClient();
    const { data: rows, error } = await supabase
      .from('assessment_draft_files')
      .select('file_size_bytes')
      .eq('draft_id', draftId)
      .eq('branch_id', branchId);
    throwIfDbError(error);
    return (rows ?? []).reduce((sum, r) => sum + (Number(r.file_size_bytes) || 0), 0);
  }

  /**
   * Upload a file to draft: store as-is (no compression). Compression runs when teacher presses Create Assessment.
   */
  async uploadDraftFile(
    draftId: string,
    branchId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<{
    fileUrl: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    draftFileId: string;
    totalSizeBytes: number;
  }> {
    const supabase = this.supabaseConfig.getClient();
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${randomStr}-${sanitized}`;
    const filePath = `drafts/${draftId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('assessment-files')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
    if (uploadError) {
      throw new BadRequestException(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('assessment-files')
      .getPublicUrl(filePath);

    const { data: row, error: insertError } = await supabase
      .from('assessment_draft_files')
      .insert({
        draft_id: draftId,
        branch_id: branchId,
        created_by: userId,
        file_path: filePath,
        file_name: file.originalname,
        file_size_bytes: file.size,
        mime_type: file.mimetype,
      })
      .select('id')
      .single();
    throwIfDbError(insertError);
    if (!row) {
      throw new BadRequestException('Failed to record draft file');
    }

    const totalSizeBytes = await this.getDraftTotalSizeBytes(draftId, branchId);
    return {
      fileUrl: publicUrl,
      fileName: file.originalname,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      draftFileId: row.id,
      totalSizeBytes,
    };
  }

  /**
   * Compress one draft file (image or video). Replaces file in storage and updates file_size_bytes. Called when teacher presses Create Assessment.
   */
  async compressDraftFile(
    draftId: string,
    fileId: string,
    branchId: string,
    userId: string,
  ): Promise<{ fileSizeBytes: number }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: row, error: fetchError } = await supabase
      .from('assessment_draft_files')
      .select('id, file_path, file_name, file_size_bytes, mime_type')
      .eq('id', fileId)
      .eq('draft_id', draftId)
      .eq('branch_id', branchId)
      .eq('created_by', userId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!row) {
      throw new NotFoundException('Draft file not found');
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from('assessment-files')
      .download(row.file_path);
    if (downloadError || !blob) {
      throw new BadRequestException(`Failed to read draft file: ${row.file_name}`);
    }
    let buffer: Buffer = Buffer.from(await blob.arrayBuffer());
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(row.file_name);
    const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(row.file_name);

    if (isImage) {
      try {
        const sharp = await import('sharp');
        const pipeline = sharp.default(buffer).resize(1920, null, { withoutEnlargement: true });
        const ext = (row.file_name.split('.').pop() || '').toLowerCase();
        if (ext === 'png') {
          buffer = (await pipeline.png({ compressionLevel: 6 }).toBuffer()) as Buffer;
        } else if (ext === 'webp') {
          buffer = (await pipeline.webp({ quality: 85 }).toBuffer()) as Buffer;
        } else if (ext === 'gif') {
          buffer = (await pipeline.gif().toBuffer()) as Buffer;
        } else {
          buffer = (await pipeline.jpeg({ quality: 85 }).toBuffer()) as Buffer;
        }
      } catch {
        // keep original buffer
      }
    } else if (isVideo) {
      const { compressVideo } = await import('./video-compression.util');
      buffer = (await compressVideo(buffer, row.mime_type ?? '', row.file_name)) as Buffer;
    }

    const finalSize = buffer.length;
    const { error: uploadError } = await supabase.storage
      .from('assessment-files')
      .upload(row.file_path, buffer, {
        contentType: row.mime_type ?? 'application/octet-stream',
        upsert: true,
      });
    if (uploadError) {
      throw new BadRequestException(`Failed to save compressed file: ${uploadError.message}`);
    }

    const { error: updateError } = await supabase
      .from('assessment_draft_files')
      .update({ file_size_bytes: finalSize })
      .eq('id', fileId)
      .eq('draft_id', draftId)
      .eq('branch_id', branchId);
    throwIfDbError(updateError);

    return { fileSizeBytes: finalSize };
  }

  /**
   * Get draft files for commit (move to assessment).
   */
  async getDraftFiles(draftId: string, branchId: string): Promise<DraftFileRow[]> {
    const supabase = this.supabaseConfig.getClient();
    const { data, error } = await supabase
      .from('assessment_draft_files')
      .select('id, draft_id, branch_id, created_by, file_path, file_name, file_size_bytes, mime_type')
      .eq('draft_id', draftId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: true });
    throwIfDbError(error);
    return (data ?? []) as DraftFileRow[];
  }

  /**
   * Delete one draft file (storage + row).
   */
  async deleteDraftFile(
    draftId: string,
    fileId: string,
    branchId: string,
    userId: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const { data: row, error: fetchError } = await supabase
      .from('assessment_draft_files')
      .select('file_path')
      .eq('id', fileId)
      .eq('draft_id', draftId)
      .eq('branch_id', branchId)
      .eq('created_by', userId)
      .maybeSingle();
    throwIfDbError(fetchError);
    if (!row) {
      throw new NotFoundException('Draft file not found');
    }
    await supabase.storage.from('assessment-files').remove([row.file_path]);
    const { error: deleteError } = await supabase
      .from('assessment_draft_files')
      .delete()
      .eq('id', fileId)
      .eq('draft_id', draftId)
      .eq('branch_id', branchId);
    throwIfDbError(deleteError);
  }

  /**
   * Commit draft files to an assessment: copy to assessment path, create attachments, update branch storage, delete draft.
   */
  async commitDraftToAssessment(
    draftId: string,
    assessmentId: string,
    branchId: string,
    _createdByUserId: string,
    userEmail: string,
  ): Promise<void> {
    const supabase = this.supabaseConfig.getClient();
    const draftFiles = await this.getDraftFiles(draftId, branchId);
    if (draftFiles.length === 0) return;

    const branchData = await this.branchesService.getById(branchId);
    const quotaBytes = branchData.storageQuotaGb * 1024 * 1024 * 1024;
    const totalDraftBytes = draftFiles.reduce((s, f) => s + Number(f.file_size_bytes), 0);
    if (branchData.storageUsedBytes + totalDraftBytes > quotaBytes) {
      throw new BadRequestException('Storage quota exceeded');
    }

    for (const f of draftFiles) {
      const { data: blob, error: downloadError } = await supabase.storage
        .from('assessment-files')
        .download(f.file_path);
      if (downloadError || !blob) {
        throw new BadRequestException(`Failed to read draft file: ${f.file_name}`);
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const sanitized = f.file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const newFileName = `${timestamp}-${randomStr}-${sanitized}`;
      const newPath = `assessments/${assessmentId}/${newFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assessment-files')
        .upload(newPath, buffer, {
          contentType: f.mime_type ?? 'application/octet-stream',
          upsert: false,
        });
      if (uploadError) {
        throw new BadRequestException(`Failed to upload file: ${f.file_name}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('assessment-files')
        .getPublicUrl(newPath);

      await supabase.from('assessment_attachments').insert({
        assessment_id: assessmentId,
        file_name: f.file_name,
        file_url: publicUrl,
        file_size_bytes: f.file_size_bytes,
        mime_type: f.mime_type ?? null,
      });

      await supabase.storage.from('assessment-files').remove([f.file_path]);
      const { error: deleteRowError } = await supabase
        .from('assessment_draft_files')
        .delete()
        .eq('id', f.id);
      throwIfDbError(deleteRowError);
    }

    const { error: quotaError } = await supabase
      .from('branches')
      .update({
        storage_used_bytes: branchData.storageUsedBytes + totalDraftBytes,
      })
      .eq('id', branchId);
    if (quotaError) {
      throw new BadRequestException('Failed to update storage quota');
    }
    this.storageService.ensureStorageAlerts(branchId).catch(() => {});
  }

  /**
   * Get all attachments for an assessment
   */
  async getAssessmentAttachments(assessmentId: string, branchId: string): Promise<AssessmentAttachmentDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Verify assessment exists and belongs to branch
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(assessmentError);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const { data: attachments, error } = await supabase
      .from('assessment_attachments')
      .select('id, assessment_id, file_name, file_url, file_size_bytes, mime_type, created_at')
      .eq('assessment_id', assessmentId)
      .order('created_at', { ascending: false });

    throwIfDbError(error);

    return (attachments ?? []).map((a) => new AssessmentAttachmentDto({
      id: a.id,
      assessmentId: a.assessment_id,
      fileName: a.file_name,
      fileUrl: a.file_url,
      fileSizeBytes: a.file_size_bytes ?? undefined,
      mimeType: a.mime_type ?? undefined,
      createdAt: a.created_at,
    }));
  }

  /**
   * Create an attachment for an assessment
   */
  async createAssessmentAttachment(
    dto: CreateAssessmentAttachmentDto,
    branchId: string,
    userEmail: string,
  ): Promise<AssessmentAttachmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', dto.assessmentId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(assessmentError);
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    const { data: attachment, error } = await supabase
      .from('assessment_attachments')
      .insert({
        assessment_id: dto.assessmentId,
        file_name: dto.fileName,
        file_url: dto.fileUrl,
        file_size_bytes: dto.fileSizeBytes ?? null,
        mime_type: dto.mimeType ?? null,
      })
      .select('id, assessment_id, file_name, file_url, file_size_bytes, mime_type, created_at')
      .single();

    throwIfDbError(error);
    if (!attachment) {
      throw new BadRequestException('Failed to create attachment');
    }

    this.auditLogService
      .logCreate(
        'assessment_attachments',
        attachment.id,
        userEmail,
        { ...attachment } as Record<string, unknown>,
        { branchId },
      )
      .catch(() => {});

    return new AssessmentAttachmentDto({
      id: attachment.id,
      assessmentId: attachment.assessment_id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      fileSizeBytes: attachment.file_size_bytes ?? undefined,
      mimeType: attachment.mime_type ?? undefined,
      createdAt: attachment.created_at,
    });
  }

  /**
   * Delete an attachment
   */
  async deleteAssessmentAttachment(
    attachmentId: string,
    branchId: string,
    userEmail: string,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow, error: attachmentError } = await supabase
      .from('assessment_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle();
    throwIfDbError(attachmentError);
    if (!oldRow) {
      throw new NotFoundException('Attachment not found');
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', oldRow.assessment_id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(assessmentError);
    if (!assessment) {
      throw new NotFoundException('Attachment not found');
    }

    const { error } = await supabase
      .from('assessment_attachments')
      .delete()
      .eq('id', attachmentId);

    throwIfDbError(error);

    this.auditLogService
      .logDelete(
        'assessment_attachments',
        attachmentId,
        userEmail,
        { ...oldRow } as Record<string, unknown>,
        { branchId },
      )
      .catch(() => {});
    return { id: attachmentId };
  }

  async getMyExaminationSchedule(
    userId: string,
    branchId: string,
    query: QueryExaminationScheduleDto,
    roles?: string[],
  ): Promise<{ data: AssessmentDto[]; meta: Meta }> {
    const listQuery: QueryAssessmentsDto = {
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy ?? 'due_date',
      sortOrder: query.sortOrder ?? 'asc',
      classSectionId: query.classSectionId,
      subjectId: query.subjectId,
      startDate: query.startDate,
      endDate: query.endDate,
      status: 'published',
    };
    return this.listAssessments(
      listQuery,
      branchId,
      query.academicYearId,
      userId,
      roles,
      true,
    );
  }

  async exportExaminationSchedulePdf(
    query: QueryExaminationScheduleDto,
    branchId: string,
    userId: string | undefined,
    roles: string[] | undefined,
    language: string,
  ): Promise<Buffer> {
    const listQuery: QueryAssessmentsDto = {
      page: 1,
      limit: 500,
      sortBy: 'due_date',
      sortOrder: 'asc',
      classSectionId: query.classSectionId,
      subjectId: query.subjectId,
      startDate: query.startDate,
      endDate: query.endDate,
      status: 'published',
    };
    const { data } = await this.listAssessments(
      listQuery,
      branchId,
      query.academicYearId,
      userId,
      roles,
      true,
    );
    return this.buildExaminationSchedulePdfFromRows(data, branchId, language);
  }

  async exportExaminationSchedulePdfForStudent(
    studentId: string,
    branchId: string,
    language: string,
  ): Promise<Buffer> {
    const { data } = await this.getExaminationScheduleForStudentById(studentId, branchId);
    return this.buildExaminationSchedulePdfFromRows(data, branchId, language);
  }

  private async buildExaminationSchedulePdfFromRows(
    rows: AssessmentDto[],
    branchId: string,
    language: string,
  ): Promise<Buffer> {
    const escape = (t: string) =>
      (t || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const locale = language === 'ar' ? 'ar' : language === 'en-US' ? 'en-US' : 'en-GB';
    const sorted = [...rows].sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return da - db;
    });
    const lbl =
      locale === 'ar'
        ? {
            date: 'تاريخ البدء',
            time: 'وقت البدء',
            dur: 'المدة',
            subj: 'المادة',
            syl: 'المنهج',
            room: 'القاعة',
          }
        : {
            date: 'Start date',
            time: 'Start time',
            dur: 'Duration',
            subj: 'Subject',
            syl: 'Syllabus',
            room: 'Room',
          };

    let bodyRows = '';
    for (const a of sorted) {
      const due = a.dueDate ? new Date(a.dueDate) : null;
      const dateStr =
        due && !Number.isNaN(due.getTime())
          ? due.toLocaleDateString(locale, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—';
      const timeStr =
        due && !Number.isNaN(due.getTime())
          ? due.toLocaleTimeString(locale, {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '—';
      const durMinutes =
        a.examinationDurationMinutes != null &&
        !Number.isNaN(Number(a.examinationDurationMinutes))
          ? Number(a.examinationDurationMinutes)
          : null;
      const durStr =
        durMinutes !== null ? formatExaminationDurationForPdf(durMinutes, locale) : '—';
      const room = a.roomNumber?.trim() ? a.roomNumber.trim() : '—';
      const syllabusHtml = renderSyllabusToHtml(a.description);
      bodyRows += `<tr><td>${escape(dateStr)}</td><td>${escape(timeStr)}</td><td>${escape(durStr)}</td><td>${escape(a.subjectName ?? '')}</td><td class="syllabus">${syllabusHtml}</td><td>${escape(room)}</td></tr>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Examination schedule</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:16px}
table{border-collapse:collapse;width:100%;table-layout:fixed}
th,td{border:1px solid #dee2e6;padding:8px;text-align:left;vertical-align:top;word-wrap:break-word}
th{background:#f1f3f5}
td.syllabus{width:38%}
</style></head><body>
<h2>Examination schedule</h2>
<table><thead><tr><th>${lbl.date}</th><th>${lbl.time}</th><th>${lbl.dur}</th><th>${lbl.subj}</th><th>${lbl.syl}</th><th>${lbl.room}</th></tr></thead><tbody>${bodyRows || '<tr><td colspan="6">—</td></tr>'}</tbody></table>
</body></html>`;

    const branding = await this.getPdfBrandingForExamination(branchId, locale);
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: getPuppeteerExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        displayHeaderFooter: true,
        headerTemplate: branding.headerTemplate,
        footerTemplate: branding.footerTemplate,
        margin: { top: '85px', right: '20px', bottom: '55px', left: '20px' },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private resolveBranchDisplayName(
    row: { name: string; name_translations?: Record<string, string> | null },
    language: string,
  ): string {
    const t = row.name_translations;
    return (t?.[language] ?? t?.en ?? row.name) || row.name;
  }

  private async getPdfBrandingForExamination(
    branchId: string,
    language: string,
  ): Promise<{ headerTemplate: string; footerTemplate: string }> {
    const supabase = this.supabaseConfig.getClient();
    const { data: branch } = await supabase
      .from('branches')
      .select('id, name, name_translations, tenant_id')
      .eq('id', branchId)
      .maybeSingle();
    const branchRow = branch as
      | { id: string; name: string; name_translations?: Record<string, string> | null; tenant_id: string | null }
      | null;

    const branchName = branchRow ? this.resolveBranchDisplayName(branchRow, language) : '—';
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
      tenantName?.trim() ? `${tenantName.trim()} - ${branchName}` : branchName;

    return {
      headerTemplate: buildPdfHeaderTemplate({
        ntgLogoDataUrl,
        branchName: schoolAndBranchName,
        tenantLogoDataUrl,
      }),
      footerTemplate: buildPdfFooterTemplate(),
    };
  }
}


