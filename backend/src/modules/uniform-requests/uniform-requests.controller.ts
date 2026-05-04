import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
import { UniformRequestsService } from './uniform-requests.service';
import { CreateUniformRequestDto } from './dto/create-uniform-request.dto';
import { QueryUniformRequestsDto } from './dto/query-uniform-requests.dto';
import { ApproveRejectDto } from './dto/approve-reject.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@ApiTags('Uniforms')
@Controller('api/v1/uniform-requests')
@UseGuards(JwtAuthGuard, BranchGuard)
export class UniformRequestsController {
  constructor(
    private readonly uniformRequestsService: UniformRequestsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0)
      throw new ForbiddenException('No role assigned for this user');

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError)
      throw new ForbiddenException('Unable to verify role permissions');
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0)
      throw new ForbiddenException('No valid role found for this user');

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', featureCode)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(
        `${featureCode} permission feature not configured`,
      );
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(
        `Unable to verify ${featureCode} edit permissions`,
      );
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit)
      throw new ForbiddenException(
        `You do not have edit access to ${featureCode}`,
      );
  }

  @Get()
  async list(
    @Query() query: QueryUniformRequestsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const isParent = user.roles?.includes('parent') ?? false;
    return this.uniformRequestsService.list(
      query,
      user.id,
      branch.branchId,
      isParent,
    );
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.uniformRequestsService.getById(id, branch.branchId);
    return { data };
  }

  @Post()
  async create(
    @Body() input: CreateUniformRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.uniformRequestsService.create(
      input,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: ApproveRejectDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const data = await this.uniformRequestsService.approve(
      id,
      body,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: ApproveRejectDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const data = await this.uniformRequestsService.reject(
      id,
      body,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/issue')
  async issue(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const data = await this.uniformRequestsService.issue(
      id,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.uniformRequestsService.cancel(
      id,
      user.id,
      branch.branchId,
    );
    return { data };
  }
}
