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
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ClassSectionsService } from './class-sections.service';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { BulkCreateClassSectionDto } from './dto/bulk-create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@ApiTags('Class sections')
@Controller('api/v1/class-sections')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ClassSectionsController {
  constructor(
    private readonly classSectionsService: ClassSectionsService,
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
    @Query() query: QueryClassSectionsDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.classSectionsService.listClassSections(query, branch.branchId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.classSectionsService.getClassSectionById(id, branch.branchId);
    return { data };
  }

  @Post()
  async create(
    @Body() input: CreateClassSectionDto | BulkCreateClassSectionDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'class_sections');
    // Check if it's bulk create
    if ('classSections' in input) {
      return this.classSectionsService.bulkCreateClassSections(
        input as BulkCreateClassSectionDto,
        branch.branchId,
        user.email,
      );
    }
    const data = await this.classSectionsService.createClassSection(
      input as CreateClassSectionDto,
      branch.branchId,
      user.email,
    );
    return { data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateClassSectionDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'class_sections');
    const data = await this.classSectionsService.updateClassSection(id, input, branch.branchId, user.email);
    return { data };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'class_sections');
    await this.classSectionsService.deleteClassSection(id, branch.branchId, user.email);
    return { message: 'Class section deleted successfully' };
  }

  @Get(':id/students')
  async getStudents(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.classSectionsService.getStudentsInClassSection(id, branch.branchId);
  }

  @Put(':id/class-teacher')
  async assignClassTeacher(
    @Param('id') id: string,
    @Body() input: AssignClassTeacherDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'class_sections');
    const data = await this.classSectionsService.assignClassTeacher(
      id,
      input.staffId ?? null,
      branch.branchId,
      user.email,
    );
    return { data };
  }
}

