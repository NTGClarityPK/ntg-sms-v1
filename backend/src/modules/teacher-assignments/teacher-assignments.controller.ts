import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { QueryTeacherAssignmentsDto } from './dto/query-teacher-assignments.dto';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/teacher-assignments')
@UseGuards(JwtAuthGuard, BranchGuard)
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) throw new ForbiddenException('No role assigned for this user');

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) throw new ForbiddenException('Unable to verify role permissions');
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) throw new ForbiddenException('No valid role found for this user');

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', featureCode)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(`${featureCode} permission feature not configured`);
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${featureCode} edit permissions`);
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) throw new ForbiddenException(`You do not have edit access to ${featureCode}`);
  }

  @Get()
  async list(
    @Query() query: QueryTeacherAssignmentsDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.teacherAssignmentsService.listTeacherAssignments(
      query,
      branch.branchId,
    );
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.teacherAssignmentsService.getTeacherAssignmentById(
      id,
      branch.branchId,
    );
    return { data };
  }

  @Post()
  async create(
    @Body() input: CreateTeacherAssignmentDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'teacher_mapping');
    const data = await this.teacherAssignmentsService.createTeacherAssignment(
      input,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateTeacherAssignmentDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'teacher_mapping');
    const data = await this.teacherAssignmentsService.updateTeacherAssignment(
      id,
      input,
      branch.branchId,
    );
    return { data };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'teacher_mapping');
    await this.teacherAssignmentsService.deleteTeacherAssignment(id, branch.branchId);
    return { message: 'Teacher assignment deleted successfully' };
  }

  @Get('by-teacher/:staffId')
  async getByTeacher(
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.teacherAssignmentsService.getAssignmentsByTeacher(
      staffId,
      branch.branchId,
      academicYearId,
    );
  }

  @Get('by-class/:classSectionId')
  async getByClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.teacherAssignmentsService.getAssignmentsByClassSection(
      classSectionId,
      branch.branchId,
      academicYearId,
    );
  }
}

