import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
import { SupabaseConfig } from '../../common/config/supabase.config';

/**
 * Controller for managing student grades
 */
@ApiTags('Grades')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/grades')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureAssessmentEditAccess(
    user: CurrentUserPayload,
    branchId: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) {
      throw new ForbiddenException('No role assigned for this user');
    }

    const supabase = this.supabaseConfig.getClient();

    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) {
      throw new ForbiddenException('Unable to verify role permissions');
    }
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) {
      throw new ForbiddenException('No valid role found for this user');
    }

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', 'assessment')
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException('Assessment permission feature not configured');
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);

    if (permissionError) {
      throw new ForbiddenException('Unable to verify assessment edit permissions');
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );

    if (!canEdit) {
      throw new ForbiddenException('You do not have edit access to Assessment');
    }
  }

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
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const created = await this.gradesService.createGrade(dto, user.id, branch.branchId, user.email);
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
    await this.ensureAssessmentEditAccess(user, branch.branchId);
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
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const updated = await this.gradesService.updateGrade(id, dto, user.id, branch.branchId, user.email);
    return { data: updated };
  }

  /**
   * Delete a grade
   */
  @Delete(':id')
  async deleteGrade(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { id: string } }> {
    await this.ensureAssessmentEditAccess(user, branch.branchId);
    const result = await this.gradesService.deleteGrade(id, branch.branchId, user.email);
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


