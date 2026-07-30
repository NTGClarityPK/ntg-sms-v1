import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CreateAssessmentRubricDto } from './dto/create-assessment-rubric.dto';
import { CreateRubricPresetDto } from './dto/create-rubric-preset.dto';
import { UpdateAssessmentRubricDto } from './dto/update-assessment-rubric.dto';
import { UpdateRubricPresetDto } from './dto/update-rubric-preset.dto';
import { UpsertStudentRubricScoresDto } from './dto/upsert-student-rubric-scores.dto';
import { RubricsService } from './rubrics.service';

@ApiTags('Rubrics')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1')
export class RubricsController {
  constructor(
    private readonly rubricsService: RubricsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureAccess(
    user: CurrentUserPayload,
    branchId: string,
    requireEdit: boolean,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin') || roleNames.includes('principal')) return;
    if (roleNames.length === 0) {
      throw new ForbiddenException('No role assigned for this user');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) {
      throw new ForbiddenException('No valid role found');
    }

    const { data: featureData } = await supabase
      .from('features')
      .select('id')
      .eq('code', 'assessment_rubrics')
      .maybeSingle();
    if (!featureData) {
      throw new ForbiddenException('Assessment rubrics feature not configured');
    }

    const { data: permissionRows } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);

    const perms = (permissionRows || []).map((r: { permission: string }) => r.permission);
    if (requireEdit) {
      if (!perms.includes('edit')) {
        throw new ForbiddenException('You do not have edit access to Assessment Rubrics');
      }
    } else if (!perms.includes('edit') && !perms.includes('view')) {
      throw new ForbiddenException('You do not have access to Assessment Rubrics');
    }
  }

  private async ensureAdmin(user: CurrentUserPayload): Promise<void> {
    const roles = user.roles || [];
    if (!roles.includes('school_admin') && !roles.includes('principal')) {
      throw new ForbiddenException('Only school admins and principals can manage rubric presets');
    }
  }

  @Get('rubrics/presets')
  async listPresets(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, false);
    return this.rubricsService.listPresets(branch.branchId);
  }

  @Post('rubrics/presets')
  async createPreset(
    @Body() body: CreateRubricPresetDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.rubricsService.createPreset(
      body,
      branch.branchId,
      branch.tenantId,
      user.id,
    );
  }

  @Put('rubrics/presets/:id')
  async updatePreset(
    @Param('id') id: string,
    @Body() body: UpdateRubricPresetDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.rubricsService.updatePreset(
      id,
      body,
      branch.branchId,
      branch.tenantId,
      user.id,
    );
  }

  @Get('assessments/:id/rubric')
  async getAssessmentRubric(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, false);
    return this.rubricsService.getAssessmentRubricWithScores(id, branch.branchId);
  }

  @Post('assessments/:id/rubric')
  async createAssessmentRubric(
    @Param('id') id: string,
    @Body() body: CreateAssessmentRubricDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, true);
    return this.rubricsService.createAssessmentRubric(
      id,
      body,
      branch.branchId,
      branch.tenantId,
      user.id,
    );
  }

  @Put('assessments/:id/rubric')
  async updateAssessmentRubric(
    @Param('id') id: string,
    @Body() body: UpdateAssessmentRubricDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, true);
    return this.rubricsService.updateAssessmentRubric(id, body, branch.branchId);
  }

  @Delete('assessments/:id/rubric')
  async deleteAssessmentRubric(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, true);
    return this.rubricsService.deleteAssessmentRubric(id, branch.branchId);
  }

  @Get('assessments/:id/rubric-scores')
  async getRubricScores(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, false);
    return this.rubricsService.getAssessmentRubricWithScores(id, branch.branchId);
  }

  @Put('student-grades/:id/rubric-scores')
  async upsertRubricScores(
    @Param('id') id: string,
    @Body() body: UpsertStudentRubricScoresDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureFeatureAccess(user, branch.branchId, true);
    return this.rubricsService.upsertStudentRubricScores(
      id,
      body,
      branch.branchId,
      user.id,
    );
  }
}
