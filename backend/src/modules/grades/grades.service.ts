import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { AuditLogService } from '../../common/services/audit-log.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { StudentsService } from '../students/students.service';
import { CreateStudentGradeDto } from './dto/create-student-grade.dto';
import { UpdateStudentGradeDto } from './dto/update-student-grade.dto';
import { StudentGradeDto } from './dto/student-grade.dto';
import { QueryGradesDto } from './dto/query-grades.dto';
import { BulkCreateGradesDto } from './dto/bulk-create-grades.dto';

type StudentGradeRow = {
  id: string;
  student_id: string;
  assessment_id: string;
  marks_obtained: number;
  submission_status: string; // 'not_submitted', 'submitted', 'late', 'excused'
  feedback: string | null;
  submitted_at: string | null;
  graded_by: string;
  graded_at: string;
  branch_id: string;
  academic_year_id: string;
  created_at: string;
  updated_at: string;
};

type Meta = { total: number; page: number; limit: number; totalPages: number };

function throwIfDbError(error: PostgrestError | null): void {
  if (!error) return;
  throw new BadRequestException(error.message);
}

/**
 * Service for managing student grades
 */
@Injectable()
export class GradesService {
  constructor(
    private readonly supabaseConfig: SupabaseConfig,
    private readonly auditLogService: AuditLogService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly assessmentsService: AssessmentsService,
    private readonly studentsService: StudentsService,
  ) {}

  private mapGradeRowToDto(row: StudentGradeRow): StudentGradeDto {
    // Convert submission_status to isAbsent and isExcused
    const isExcused = row.submission_status === 'excused';
    const isAbsent = row.submission_status === 'not_submitted';
    
    return new StudentGradeDto({
      id: row.id,
      studentId: row.student_id,
      assessmentId: row.assessment_id,
      marksObtained: row.marks_obtained,
      isAbsent,
      isExcused,
      remarks: row.feedback ?? undefined,
      submittedAt: row.submitted_at ?? undefined,
      gradedBy: row.graded_by,
      gradedAt: row.graded_at,
      branchId: row.branch_id,
      academicYearId: row.academic_year_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  /**
   * Create a single grade for a student
   */
  async createGrade(
    dto: CreateStudentGradeDto,
    userId: string,
    branchId: string,
    userEmail: string,
  ): Promise<StudentGradeDto> {
    const supabase = this.supabaseConfig.getClient();

    // Validate assessment exists and get its details
    const assessment = await this.assessmentsService.getAssessmentById(dto.assessmentId, branchId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found.');
    }

    // Validate marks don't exceed total marks
    if (dto.marksObtained > assessment.totalMarks) {
      throw new BadRequestException(
        `Marks obtained (${dto.marksObtained}) cannot exceed total marks (${assessment.totalMarks}).`,
      );
    }

    // Get class section details to get class_id and section_id
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', assessment.classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(csError);
    if (!classSection) {
      throw new NotFoundException('Class section not found.');
    }

    // Validate student exists and belongs to the assessment's class section
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, section_id, branch_id, academic_year_id')
      .eq('id', dto.studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academicYearId)
      .maybeSingle();
    throwIfDbError(studentError);

    if (!student) {
      throw new NotFoundException('Student not found in this branch and academic year.');
    }

    if (student.class_id !== classSection.class_id || student.section_id !== classSection.section_id) {
      throw new BadRequestException('Student does not belong to the assessment\'s class section.');
    }

    // Check for duplicate grade
    const { data: existingGrade, error: existingError } = await supabase
      .from('student_grades')
      .select('id')
      .eq('student_id', dto.studentId)
      .eq('assessment_id', dto.assessmentId)
      .maybeSingle();
    throwIfDbError(existingError);

    if (existingGrade) {
      throw new BadRequestException('Grade already exists for this student and assessment.');
    }

    // Determine submission_status from isAbsent and isExcused
    let submissionStatus: string;
    if (dto.isExcused) {
      submissionStatus = 'excused';
    } else if (dto.isAbsent) {
      submissionStatus = 'not_submitted';
    } else {
      submissionStatus = 'submitted';
    }

    const { data, error } = await supabase
      .from('student_grades')
      .insert({
        student_id: dto.studentId,
        assessment_id: dto.assessmentId,
        marks_obtained: dto.marksObtained,
        submission_status: submissionStatus,
        feedback: dto.remarks ?? null,
        submitted_at: dto.submittedAt ?? new Date().toISOString(),
        graded_by: userId,
        graded_at: new Date().toISOString(),
        branch_id: branchId,
        academic_year_id: assessment.academicYearId,
      })
      .select('*')
      .single();
    throwIfDbError(error);

    const row = data as StudentGradeRow;
    this.auditLogService
      .logCreate('student_grades', row.id, userEmail, { ...row } as Record<string, unknown>, {
        branchId,
      })
      .catch(() => {});
    return this.mapGradeRowToDto(row);
  }

  /**
   * Bulk create grades for multiple students for a single assessment
   */
  async bulkCreateGrades(
    dto: BulkCreateGradesDto,
    userId: string,
    branchId: string,
  ): Promise<{ data: StudentGradeDto[]; errors: Array<{ studentId: string; error: string }> }> {
    const supabase = this.supabaseConfig.getClient();

    // Validate assessment
    const assessment = await this.assessmentsService.getAssessmentById(dto.assessmentId, branchId);
    if (!assessment) {
      throw new NotFoundException('Assessment not found.');
    }

    const successfulGrades: StudentGradeDto[] = [];
    const errors: Array<{ studentId: string; error: string }> = [];

    // Get class section details to get class_id and section_id
    const { data: classSection, error: csError } = await supabase
      .from('class_sections')
      .select('class_id, section_id')
      .eq('id', assessment.classSectionId)
      .eq('branch_id', branchId)
      .maybeSingle();
    
    if (csError) {
      throw new BadRequestException(`Failed to get class section: ${csError.message}`);
    }
    if (!classSection) {
      throw new NotFoundException('Class section not found.');
    }

    // Get all students for the class section (students table uses class_id and section_id, not class_section_id)
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, class_id, section_id, branch_id, academic_year_id')
      .eq('branch_id', branchId)
      .eq('academic_year_id', assessment.academicYearId)
      .eq('class_id', classSection.class_id)
      .eq('section_id', classSection.section_id);
    
    if (studentsError) {
      throw new BadRequestException(`Failed to get students: ${studentsError.message}`);
    }

    const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

    // Check for existing grades - get full records including IDs for updates
    const studentIds = dto.grades.map((g) => g.studentId);
    const { data: existingGrades, error: existingError } = await supabase
      .from('student_grades')
      .select('id, student_id, assessment_id')
      .eq('assessment_id', dto.assessmentId)
      .in('student_id', studentIds);
    throwIfDbError(existingError);

    const existingGradeMap = new Map(
      (existingGrades ?? []).map((eg) => [`${eg.student_id}-${eg.assessment_id}`, eg.id]),
    );

    // OPTIMIZED: Separate into updates and inserts, then batch process
    const toUpdate: Array<{ gradeId: string; gradeDto: any; submissionStatus: string }> = [];
    const toInsert: Array<any> = [];
    const now = new Date().toISOString();

    // Validate and categorize all grades first
    for (const gradeDto of dto.grades) {
      try {
        // Validate student
        const student = studentMap.get(gradeDto.studentId);
        if (!student) {
          errors.push({
            studentId: gradeDto.studentId,
            error: 'Student not found in assessment class section.',
          });
          continue;
        }

        // Validate marks
        if (gradeDto.marksObtained > assessment.totalMarks) {
          errors.push({
            studentId: gradeDto.studentId,
            error: `Marks (${gradeDto.marksObtained}) exceed total marks (${assessment.totalMarks}).`,
          });
          continue;
        }

        // Determine submission_status from isAbsent and isExcused
        let submissionStatus: string;
        if (gradeDto.isExcused) {
          submissionStatus = 'excused';
        } else if (gradeDto.isAbsent) {
          submissionStatus = 'not_submitted';
        } else {
          submissionStatus = 'submitted';
        }

        const gradeKey = `${gradeDto.studentId}-${dto.assessmentId}`;
        const existingGradeId = existingGradeMap.get(gradeKey);

        if (existingGradeId) {
          toUpdate.push({
            gradeId: existingGradeId,
            gradeDto,
            submissionStatus,
          });
        } else {
          toInsert.push({
            student_id: gradeDto.studentId,
            assessment_id: dto.assessmentId,
            marks_obtained: gradeDto.marksObtained,
            submission_status: submissionStatus,
            feedback: gradeDto.remarks ?? null,
            submitted_at: gradeDto.submittedAt ?? now,
            graded_by: userId,
            graded_at: now,
            branch_id: branchId,
            academic_year_id: assessment.academicYearId,
          });
        }
      } catch (err) {
        errors.push({
          studentId: gradeDto.studentId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // OPTIMIZED: Batch update all existing grades in parallel
    const updatePromises = toUpdate.map(async ({ gradeId, gradeDto, submissionStatus }) => {
      try {
        const result = await supabase
          .from('student_grades')
          .update({
            marks_obtained: gradeDto.marksObtained,
            submission_status: submissionStatus,
            feedback: gradeDto.remarks ?? null,
            submitted_at: gradeDto.submittedAt ?? now,
            graded_by: userId,
            graded_at: now,
            updated_at: now,
          })
          .eq('id', gradeId)
          .select('*')
          .single();

        if (result.error) {
          errors.push({ studentId: gradeDto.studentId, error: result.error.message });
          return null;
        }
        return result.data as StudentGradeRow;
      } catch (err: unknown) {
        errors.push({
          studentId: gradeDto.studentId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return null;
      }
    });

    const updatedGrades = await Promise.all(updatePromises);
    updatedGrades.forEach((grade: StudentGradeRow | null) => {
      if (grade) {
        successfulGrades.push(this.mapGradeRowToDto(grade));
      }
    });

    // OPTIMIZED: Batch insert all new grades at once
    if (toInsert.length > 0) {
      const { data: insertedGrades, error: insertError } = await supabase
        .from('student_grades')
        .insert(toInsert)
        .select('*');

      if (insertError) {
        // If batch insert fails, add error for all
        toInsert.forEach((insert) => {
          errors.push({
            studentId: insert.student_id,
            error: insertError.message,
          });
        });
      } else {
        (insertedGrades || []).forEach((grade) => {
          successfulGrades.push(this.mapGradeRowToDto(grade as StudentGradeRow));
        });
      }
    }

    return { data: successfulGrades, errors };
  }

  /**
   * Update an existing grade
   */
  async updateGrade(
    id: string,
    dto: UpdateStudentGradeDto,
    userId: string,
    branchId: string,
    userEmail: string,
  ): Promise<StudentGradeDto> {
    const supabase = this.supabaseConfig.getClient();

    // Get existing grade
    const { data: existing, error: existingError } = await supabase
      .from('student_grades')
      .select('*, assessments:assessment_id(total_marks)')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);

    if (!existing) {
      throw new NotFoundException('Grade not found.');
    }

    // Validate marks if provided
    if (dto.marksObtained !== undefined) {
      const totalMarks = (existing as any).assessments?.total_marks;
      if (totalMarks && dto.marksObtained > totalMarks) {
        throw new BadRequestException(
          `Marks obtained (${dto.marksObtained}) cannot exceed total marks (${totalMarks}).`,
        );
      }
    }

    // Determine submission_status from isAbsent and isExcused if provided
    const updateData: any = {
      marks_obtained: dto.marksObtained,
      feedback: dto.remarks,
      submitted_at: dto.submittedAt,
      graded_by: userId,
      graded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update submission_status if isAbsent or isExcused is provided
    if (dto.isExcused !== undefined || dto.isAbsent !== undefined) {
      if (dto.isExcused) {
        updateData.submission_status = 'excused';
      } else if (dto.isAbsent) {
        updateData.submission_status = 'not_submitted';
      } else {
        updateData.submission_status = 'submitted';
      }
    }

    const { data, error } = await supabase
      .from('student_grades')
      .update(updateData)
      .eq('id', id)
      .eq('branch_id', branchId)
      .select('*')
      .single();
    throwIfDbError(error);

    const newRow = data as StudentGradeRow;
    const oldRow = existing as StudentGradeRow & { assessments?: unknown };
    this.auditLogService
      .logUpdate(
        'student_grades',
        id,
        userEmail,
        { ...oldRow } as Record<string, unknown>,
        { ...newRow } as Record<string, unknown>,
        Object.keys(updateData).filter((k) => k !== 'updated_at'),
        { branchId },
      )
      .catch(() => {});
    return this.mapGradeRowToDto(newRow);
  }

  /**
   * Delete a grade
   */
  async deleteGrade(
    id: string,
    branchId: string,
    userEmail: string,
  ): Promise<{ id: string }> {
    const supabase = this.supabaseConfig.getClient();

    const { data: oldRow, error: existingError } = await supabase
      .from('student_grades')
      .select('*')
      .eq('id', id)
      .eq('branch_id', branchId)
      .maybeSingle();
    throwIfDbError(existingError);

    if (!oldRow) {
      throw new NotFoundException('Grade not found.');
    }

    const { error } = await supabase.from('student_grades').delete().eq('id', id).eq('branch_id', branchId);
    throwIfDbError(error);

    this.auditLogService
      .logDelete(
        'student_grades',
        id,
        userEmail,
        { ...oldRow } as Record<string, unknown>,
        { branchId },
      )
      .catch(() => {});
    return { id };
  }

  /**
   * Query grades with filters
   */
  async queryGrades(
    query: QueryGradesDto,
    branchId: string,
  ): Promise<{ data: StudentGradeDto[]; meta: Meta }> {
    const supabase = this.supabaseConfig.getClient();
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const sortBy = query.sortBy ?? 'created_at';
    const sortOrder = query.sortOrder ?? 'desc';

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    let dbQuery = supabase
      .from('student_grades')
      .select(
        `
        *,
        students:student_id(id, first_name, last_name, class_id, section_id),
        assessments:assessment_id(id, title, subject_id, class_section_id, total_marks)
      `,
        { count: 'exact' },
      )
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id);

    if (query.assessmentId) {
      dbQuery = dbQuery.eq('assessment_id', query.assessmentId);
    }
    if (query.studentId) {
      dbQuery = dbQuery.eq('student_id', query.studentId);
    }
    if (query.isAbsent !== undefined) {
      dbQuery = dbQuery.eq('submission_status', query.isAbsent ? 'not_submitted' : 'submitted');
    }
    if (query.isExcused !== undefined) {
      dbQuery = dbQuery.eq('submission_status', query.isExcused ? 'excused' : 'submitted');
    }

    // If class section or subject filter provided, we need to join through assessments
    if (query.classSectionId || query.subjectId) {
      const { data: assessmentIds, error: aError } = await supabase
        .from('assessments')
        .select('id')
        .eq('branch_id', branchId)
        .eq('academic_year_id', activeYear.id)
        .match({
          ...(query.classSectionId ? { class_section_id: query.classSectionId } : {}),
          ...(query.subjectId ? { subject_id: query.subjectId } : {}),
        });
      throwIfDbError(aError);

      const ids = (assessmentIds ?? []).map((a) => a.id);
      if (ids.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
      dbQuery = dbQuery.in('assessment_id', ids);
    }

    if (query.search) {
      // Search in student names - this requires a more complex query
      // For now, we'll skip this or implement it via student filter
    }

    dbQuery = dbQuery.range(from, to).order(sortBy, { ascending: sortOrder === 'asc' });

    const { data, error, count } = await dbQuery;
    throwIfDbError(error);

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: ((data as any[]) ?? []).map((row) => this.mapGradeRowToDto(row)),
      meta: { total, page, limit, totalPages },
    };
  }

  /**
   * Get grades for a specific assessment (all students)
   */
  async getGradesByAssessment(
    assessmentId: string,
    branchId: string,
  ): Promise<StudentGradeDto[]> {
    const supabase = this.supabaseConfig.getClient();

    // Validate assessment
    await this.assessmentsService.getAssessmentById(assessmentId, branchId);

    const { data, error } = await supabase
      .from('student_grades')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    throwIfDbError(error);

    return ((data as StudentGradeRow[]) ?? []).map((row) => this.mapGradeRowToDto(row));
  }

  /**
   * Get grades for a specific student (all assessments)
   */
  async getGradesByStudent(studentId: string, branchId: string): Promise<StudentGradeDto[]> {
    const supabase = this.supabaseConfig.getClient();

    const activeYear = await this.academicYearsService.getActiveForBranch(branchId);
    if (!activeYear) {
      return [];
    }

    // Validate student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .maybeSingle();
    throwIfDbError(studentError);

    if (!student) {
      throw new NotFoundException('Student not found.');
    }

    const { data, error } = await supabase
      .from('student_grades')
      .select('*')
      .eq('student_id', studentId)
      .eq('branch_id', branchId)
      .eq('academic_year_id', activeYear.id)
      .order('graded_at', { ascending: false });
    throwIfDbError(error);

    return ((data as StudentGradeRow[]) ?? []).map((row) => this.mapGradeRowToDto(row));
  }
}

