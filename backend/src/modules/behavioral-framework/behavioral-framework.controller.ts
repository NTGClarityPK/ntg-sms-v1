import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
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
import { SupabaseConfig } from '../../common/config/supabase.config';
import {
  FeatureAccessGuard,
  RequiresFeature,
} from '../subscription/guards/feature-access.guard';
import { BehavioralFrameworkService } from './behavioral-framework.service';
import {
  CreateBlankFrameworkPresetDto,
  CreateFrameworkCategoryDto,
  UpdateBranchBehavioralConfigDto,
  UpdateFrameworkCategoryDto,
  UpdateFrameworkPresetDto,
} from './dto/preset.dto';
import {
  CreateFrameworkRatingDto,
  UpdateFrameworkRatingDto,
} from './dto/rating.dto';

@ApiTags('Behavioural Framework')
@Controller('api/v1/behavioral-framework')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasBehavioralTracking')
export class BehavioralFrameworkController {
  constructor(
    private readonly service: BehavioralFrameworkService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
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
      .eq('code', 'behavioral')
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException('behavioral permission feature not configured');
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException('Unable to verify behavioral edit permissions');
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) throw new ForbiddenException('You do not have edit access to behavioral');
  }

  private ensureAdminOrPrincipal(user: CurrentUserPayload): void {
    const roles = user.roles || [];
    if (!roles.includes('school_admin') && !roles.includes('principal')) {
      throw new ForbiddenException(
        'Only school admins and principals can manage behavioural framework configuration',
      );
    }
  }

  private isAdminOrPrincipal(user: CurrentUserPayload): boolean {
    const roles = user.roles || [];
    return roles.includes('school_admin') || roles.includes('principal');
  }

  // ---- Config ----

  @Get('config')
  async getConfig(@CurrentBranch() branch: CurrentBranchContext) {
    return this.service.getConfig(branch.branchId);
  }

  @Put('config')
  async updateConfig(
    @Body() dto: UpdateBranchBehavioralConfigDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.updateConfig(branch.branchId, user.id, dto);
  }

  // ---- Presets ----

  @Get('presets')
  async listPresets(@CurrentBranch() branch: CurrentBranchContext) {
    return this.service.listPresets(branch.branchId);
  }

  @Post('presets/from-global/:presetCode')
  async cloneFromGlobal(
    @Param('presetCode') presetCode: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.cloneFromGlobal(presetCode, branch.branchId);
  }

  @Post('presets')
  async createBlankPreset(
    @Body() dto: CreateBlankFrameworkPresetDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.createBlankPreset(branch.branchId, dto);
  }

  @Get('presets/:id')
  async getPreset(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.service.getPreset(id, branch.branchId);
  }

  @Put('presets/:id')
  async updatePreset(
    @Param('id') id: string,
    @Body() dto: UpdateFrameworkPresetDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.updatePreset(id, branch.branchId, dto);
  }

  @Delete('presets/:id')
  async deletePreset(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.deletePreset(id, branch.branchId);
  }

  // ---- Categories (static paths before :id where needed) ----

  @Post('presets/:id/categories')
  async addCategory(
    @Param('id') presetId: string,
    @Body() dto: CreateFrameworkCategoryDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.addCategory(presetId, branch.branchId, dto);
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateFrameworkCategoryDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.updateCategory(id, branch.branchId, dto);
  }

  @Delete('categories/:id')
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    this.ensureAdminOrPrincipal(user);
    return this.service.deleteCategory(id, branch.branchId);
  }

  // ---- Ratings ----

  @Post('ratings')
  async createRating(
    @Body() dto: CreateFrameworkRatingDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.service.createRating(dto, user.id, branch.branchId);
  }

  @Get('ratings/student/:studentId')
  async getRatingsForStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.getRatingsForStudent(
      studentId,
      branch.branchId,
      academicYearId,
    );
  }

  @Put('ratings/:id')
  async updateRating(
    @Param('id') id: string,
    @Body() dto: UpdateFrameworkRatingDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.service.updateRating(id, dto, user.id, branch.branchId);
  }

  @Delete('ratings/:id')
  async deleteRating(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.service.deleteRating(
      id,
      user.id,
      branch.branchId,
      this.isAdminOrPrincipal(user),
    );
  }

  // ---- Reports ----

  @Get('reports/student/:studentId')
  async getCombinedStudentHistory(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.service.getCombinedStudentHistory(
      studentId,
      branch.branchId,
      academicYearId,
    );
  }

  @Get('reports/class/:classSectionId')
  async getClassReport(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('month') month?: string,
  ) {
    return this.service.getClassReport(classSectionId, month, branch.branchId);
  }
}
