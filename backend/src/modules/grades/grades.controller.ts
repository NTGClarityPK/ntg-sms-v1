import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { GradesService } from './grades.service';
import { CreateStudentGradeDto } from './dto/create-student-grade.dto';
import { UpdateStudentGradeDto } from './dto/update-student-grade.dto';
import { StudentGradeDto } from './dto/student-grade.dto';
import { QueryGradesDto } from './dto/query-grades.dto';
import { BulkCreateGradesDto } from './dto/bulk-create-grades.dto';

/**
 * Controller for managing student grades
 */
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  /**
   * Query grades with filters (paginated)
   */
  @Get()
  async queryGrades(
    @Query() query: QueryGradesDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentGradeDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.gradesService.queryGrades(query, branch.branchId);
  }

  /**
   * Create a single grade
   */
  @Post()
  async createGrade(
    @Body() dto: CreateStudentGradeDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentGradeDto }> {
    const created = await this.gradesService.createGrade(dto, user.id, branch.branchId);
    return { data: created };
  }

  /**
   * Bulk create grades for multiple students
   */
  @Post('bulk')
  async bulkCreateGrades(
    @Body() dto: BulkCreateGradesDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentGradeDto[]; errors: Array<{ studentId: string; error: string }> }> {
    return this.gradesService.bulkCreateGrades(dto, user.id, branch.branchId);
  }

  /**
   * Update a grade
   */
  @Put(':id')
  async updateGrade(
    @Param('id') id: string,
    @Body() dto: UpdateStudentGradeDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentGradeDto }> {
    const updated = await this.gradesService.updateGrade(id, dto, user.id, branch.branchId);
    return { data: updated };
  }

  /**
   * Delete a grade
   */
  @Delete(':id')
  async deleteGrade(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { id: string } }> {
    const result = await this.gradesService.deleteGrade(id, branch.branchId);
    return { data: result };
  }

  /**
   * Get all grades for a specific assessment
   */
  @Get('assessment/:assessmentId')
  async getGradesByAssessment(
    @Param('assessmentId') assessmentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentGradeDto[] }> {
    const grades = await this.gradesService.getGradesByAssessment(assessmentId, branch.branchId);
    return { data: grades };
  }

  /**
   * Get all grades for a specific student
   */
  @Get('student/:studentId')
  async getGradesByStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentGradeDto[] }> {
    const grades = await this.gradesService.getGradesByStudent(studentId, branch.branchId);
    return { data: grades };
  }
}


