import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { ClassSectionsService } from '../class-sections/class-sections.service';
import { TeacherAssignmentsService } from '../teacher-assignments/teacher-assignments.service';
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

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly academicYearsService: AcademicYearsService,
    private readonly classSectionsService: ClassSectionsService,
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
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

    // Validate class-section belongs to branch + get academic year
    const classSection = await this.classSectionsService.getClassSectionById(
      input.classSectionId,
      branchId,
    );
    const academicYearId = classSection.academicYearId;

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

    // Optionally validate teacher assignment (subject/class-section) here later using teacherAssignmentsService

    const { data, error } = await supabase
      .from('assessments')
      .insert({
        title: input.title,
        description: input.description ?? null,
        assessment_type_id: input.assessmentTypeId,
        subject_id: input.subjectId,
        class_section_id: input.classSectionId,
        created_by: createdByUserId,
        total_marks: input.totalMarks,
        due_date: input.dueDate ?? null,
        publish_date: input.publishDate ?? null,
        is_published: input.isPublished ?? false,
        allow_late_submission: input.allowLateSubmission ?? false,
        branch_id: branchId,
        academic_year_id: academicYearId,
      })
      .select(
        'id, title, description, assessment_type_id, subject_id, class_section_id, created_by, total_marks, due_date, publish_date, is_published, allow_late_submission, branch_id, academic_year_id, created_at, updated_at',
      )
      .single();
    throwIfDbError(error);

    return mapAssessment(data as AssessmentRow);
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

    const submissionRate = totalStudents ? (gradedCount / totalStudents) * 100 : 0;
    const completionRate = totalStudents ? ((gradedCount - absentCount - excusedCount) / totalStudents) * 100 : 0;

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
}


