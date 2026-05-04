import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import {
  CurrentBranch,
  type CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { UniformIssuancesService } from './uniform-issuances.service';
import { CreateDirectIssuanceDto } from './dto/create-direct-issuance.dto';
import { QueryIssuanceReportDto } from './dto/query-issuance-report.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@ApiTags('Uniforms')
@Controller('api/v1/uniform-issuances')
@UseGuards(JwtAuthGuard, BranchGuard)
export class UniformIssuancesController {
  constructor(
    private readonly uniformIssuancesService: UniformIssuancesService,
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

  @Get('report')
  async getReport(
    @Query() query: QueryIssuanceReportDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const data = await this.uniformIssuancesService.getReport(
      query,
      branch.branchId,
    );
    return { data };
  }

  @Get('student/:studentId')
  async getByStudentId(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.uniformIssuancesService.getByStudentId(
      studentId,
      branch.branchId,
    );
    return { data };
  }

  @Post()
  async createDirectIssuance(
    @Body() input: CreateDirectIssuanceDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'inventory');
    const data = await this.uniformIssuancesService.createDirectIssuance(
      input,
      user.id,
      branch.branchId,
    );
    return { data };
  }
}
