import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ClassSectionsService } from '../class-sections/class-sections.service';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';
import { StaffService } from '../staff/staff.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssessmentDto } from './dto/assessment.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import {
  AssessmentPublishStatus,
  QueryAssessmentsDto,
} from './dto/query-assessments.dto';
import { AssessmentStatisticsDto } from './dto/assessment-statistics.dto';
import { ClassStatisticsDto } from './dto/class-statistics.dto';
import { SubjectStatisticsDto } from './dto/subject-statistics.dto';
import { StudentPerformanceDto } from './dto/student-performance.dto';
import { AssessmentStudentStatusDto } from './dto/assessment-student-status.dto';
import { StudentAssessmentStatusDto } from './dto/student-assessment-status.dto';
import { UpdateStudentAssessmentStatusDto } from './dto/update-student-assessment-status.dto';
import { AssessmentAttachmentDto } from './dto/assessment-attachment.dto';
import { CreateAssessmentAttachmentDto } from './dto/create-assessment-attachment.dto';

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
  publish_date: string | null;
  is_published: boolean;
  allow_late_submission: boolean;
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

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
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
    branchId: row.branch_id,
    academicYearId: row.academic_year_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly classSectionsService: ClassSectionsService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly staffService: StaffService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listAssessments(
    query: QueryAssessmentsDto,
    branchId: string,
    academicYearId?: string,
    currentUserId?: string,
  ): Promise<{ data: AssessmentDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

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

    let dbQuery = supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('academic_year_id', yearId)
      .range(from, to)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (query.classSectionId) {
      dbQuery = dbQuery.eq('class_section_id', query.classSectionId);
    }

    if (query.subjectId) {
      dbQuery = dbQuery.eq('subject_id', query.subjectId);
    }

    if (query.assessmentTypeId) {
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

    // In future we can restrict by teacher/student using currentUserId + teacherAssignmentsService
    return {
      data: rows.map(mapAssessment),
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
  ): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

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
      .select('id')
      .eq('id', input.assessmentTypeId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(typeError);
    if (!typeRow) {
      throw new BadRequestException('Assessment type not found for branch');
    }

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

    // Create assessments for each class-section
    const assessmentsToInsert = classSectionIdsToCreate.map((classSectionId) => ({
      title: input.title,
      description: input.description ?? null,
      assessment_type_id: input.assessmentTypeId,
      subject_id: input.subjectId,
      class_section_id: classSectionId,
      created_by: createdByUserId,
      total_marks: input.totalMarks,
      due_date: input.dueDate ?? null,
      publish_date: input.publishDate ?? null,
      is_published: input.isPublished ?? false,
      allow_late_submission: input.allowLateSubmission ?? false,
      branch_id: branchId,
      academic_year_id: academicYearId,
    }));

    const { data, error } = await supabase
      .from('assessments')
      .insert(assessmentsToInsert)
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
      );
    throwIfDbError(error);

    if (!data || data.length === 0) {
      throw new BadRequestException('Failed to create assessments');
    }

    // Return the first created assessment
    return mapAssessment(data[0] as AssessmentRow);
  }

  async updateAssessment(
    id: string,
    input: UpdateAssessmentDto,
    branchId: string,
  ): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }

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
    if (input.allowLateSubmission !== undefined)
      payload.allow_late_submission = input.allowLateSubmission;

    const { data, error } = await supabase
      .from('assessments')
      .update(payload)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);

    return mapAssessment(data as AssessmentRow);
  }

  async deleteAssessment(id: string, branchId: string): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: existing, error: existingError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }

    // Prevent deletion if grades exist
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

    return { id };
  }

  async getAssessmentById(id: string, branchId: string): Promise<AssessmentDto> {
    const supabase = this.supabaseConfig.getClient();

    const { data, error } = await supabase
      .from('assessments')
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
      )
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Assessment not found');
    }

    return mapAssessment(data as AssessmentRow);
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
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
      )
      .maybeSingle();
    throwIfDbError(error);
    if (!data) {
      throw new NotFoundException('Assessment not found');
    }

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

    // Get total students in the class section (students table uses class_id and section_id, not class_section_id)
    const { count: totalStudents, error: studentsError } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', classSection.classId)
      .eq('section_id', classSection.sectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academic_year_id)
      .eq('is_active', true);
    throwIfDbError(studentsError);

    // Get grades statistics
    const { data: grades, error: gradesError } = await supabase
      .from('student_grades')
      .select('marks_obtained, submission_status')
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId);
    throwIfDbError(gradesError);

    const gradedCount = (grades ?? []).length;
    // submission_status: 'not_submitted', 'submitted', 'late', 'excused'
    const absentCount = (grades ?? []).filter((g) => g.submission_status === 'not_submitted').length;
    const excusedCount = (grades ?? []).filter((g) => g.submission_status === 'excused').length;
    const ungradedCount = (totalStudents ?? 0) - gradedCount;

    // Calculate statistics for non-absent and non-excused students
    const validGrades = (grades ?? []).filter(
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

    // Get all active students in this class/section/year
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, user_id, student_id, branch_id, academic_year_id')
      .eq('class_id', classSection.classId)
      .eq('section_id', classSection.sectionId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academic_year_id)
      .eq('is_active', true);
    throwIfDbError(studentsError);

    if (!students || students.length === 0) {
      return [];
    }

    const studentIds = students.map((s: any) => s.id as string);

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
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
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
      const assessment = mapAssessment(row);
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
  ): Promise<AssessmentAttachmentDto> {
    const supabase = this.supabaseConfig.getClient();

    // Verify assessment exists and belongs to branch
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
        file_size_bytes: null, // Can be added if needed
        mime_type: dto.mimeType ?? null,
      })
      .select('id, assessment_id, file_name, file_url, file_size_bytes, mime_type, created_at')
      .single();

    throwIfDbError(error);
    if (!attachment) {
      throw new BadRequestException('Failed to create attachment');
    }

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
  async deleteAssessmentAttachment(attachmentId: string, branchId: string): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    // Verify attachment exists and belongs to an assessment in this branch
    const { data: attachment, error: attachmentError } = await supabase
      .from('assessment_attachments')
      .select('id, assessment_id')
      .eq('id', attachmentId)
      .maybeSingle();
    throwIfDbError(attachmentError);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Verify the assessment belongs to this branch
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', attachment.assessment_id)
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

    return { id: attachmentId };
  }
}


