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
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { LinkChildDto } from './dto/link-child.dto';
import { SelectChildDto } from './dto/select-child.dto';
import { UpdateParentAssociationDto } from './dto/update-parent-association.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/parents')
@UseGuards(JwtAuthGuard)
export class ParentsController {
  constructor(
    private readonly parentsService: ParentsService,
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

  @Get('associations')
  @UseGuards(BranchGuard)
  async listAssociations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('parentId') parentId?: string,
    @Query('studentId') studentId?: string,
    @CurrentBranch() branch?: { branchId: string; tenantId: string },
  ) {
    const data = await this.parentsService.listAssociations(
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        parentId,
        studentId,
      },
      branch?.branchId || '',
    );
    return data;
  }

  @Get(':id/children')
  @UseGuards(BranchGuard)
  async getChildren(
    @Param('id') id: string,
    @CurrentBranch() branch?: { branchId: string; tenantId: string },
  ) {
    const data = await this.parentsService.getChildren(id, branch?.branchId);
    return { data };
  }

  @Post(':id/children')
  @UseGuards(BranchGuard)
  async linkChild(
    @Param('id') id: string,
    @Body() input: LinkChildDto,
    @CurrentBranch() branch: { branchId: string; tenantId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'parent_associations');
    const data = await this.parentsService.linkChild(
      id,
      input,
      user.email,
      branch.branchId,
      branch.tenantId,
    );
    return { data };
  }

  @Put(':id/children/:studentId')
  @UseGuards(BranchGuard)
  async updateParentAssociation(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Body() input: UpdateParentAssociationDto,
    @CurrentBranch() branch: { branchId: string; tenantId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'parent_associations');
    const data = await this.parentsService.updateParentAssociation(
      id,
      studentId,
      input,
      user.email,
      branch.branchId,
      branch.tenantId,
    );
    return { data };
  }

  @Delete(':id/children/:studentId')
  @UseGuards(BranchGuard)
  async unlinkChild(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string; tenantId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'parent_associations');
    await this.parentsService.unlinkChild(
      id,
      studentId,
      user.email,
      branch.branchId,
      branch.tenantId,
    );
    return { data: { success: true } };
  }

  @Get('students/:studentId/guardians')
  @UseGuards(BranchGuard)
  async getGuardiansForStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch?: { branchId: string; tenantId: string },
  ) {
    const data = await this.parentsService.getGuardiansForStudent(studentId);
    return { data };
  }
}

