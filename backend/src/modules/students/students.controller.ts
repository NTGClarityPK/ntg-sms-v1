import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { QueryStudentsDto } from './dto/query-students.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { GenerateStudentIdDto } from './dto/generate-student-id.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/students')
@UseGuards(JwtAuthGuard, BranchGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
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
    if (!canEdit) {
      throw new ForbiddenException(`You do not have edit access to ${featureCode}`);
    }
  }

  @Get()
  async listStudents(
    @Query() query: QueryStudentsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: { id: string; roles?: string[] },
  ) {
    return this.studentsService.listStudents(query, branch.branchId, user.id, user.roles);
  }

  @Get('generate-id')
  async generateStudentId(
    @Query() query: GenerateStudentIdDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.generateStudentId(query, branch.branchId);
    return { data };
  }

  @Get(':id')
  async getStudentById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.getStudentById(id, branch.branchId);
    return { data };
  }

  @Post()
  async createStudent(
    @Body() input: CreateStudentDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'students');
    const data = await this.studentsService.createStudent(input, branch.branchId);
    return { data };
  }

  @Post('bulk-import')
  async bulkImport(
    @Body() input: { students: CreateStudentDto[] },
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'students');
    const data = await this.studentsService.bulkImport(input.students, branch.branchId);
    return { data };
  }

  @Put(':id')
  async updateStudent(
    @Param('id') id: string,
    @Body() input: UpdateStudentDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'students');
    const data = await this.studentsService.updateStudent(id, input, branch.branchId);
    return { data };
  }
}

