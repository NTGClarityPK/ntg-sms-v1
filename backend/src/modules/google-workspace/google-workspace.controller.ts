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
  CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { CreateGoogleCourseMappingDto } from './dto/create-mapping.dto';
import { LinkAssessmentGoogleDto } from './dto/link-assessment.dto';
import { QuerySyncHistoryDto } from './dto/query-sync-history.dto';
import { UpdateGoogleWorkspaceSettingsDto } from './dto/update-settings.dto';
import { GoogleWorkspaceService } from './google-workspace.service';

const FEATURE_CODE = 'google_classroom_integration';
const ADMIN_ROLES = new Set(['school_admin', 'principal']);

@ApiTags('Google Workspace')
@Controller('api/v1/google-workspace')
@UseGuards(JwtAuthGuard, BranchGuard)
export class GoogleWorkspaceController {
  constructor(
    private readonly googleWorkspaceService: GoogleWorkspaceService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  @Get('settings')
  async getSettings(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.getSettings(
      branch.branchId,
      branch.tenantId,
    );
  }

  @Put('settings')
  async updateSettings(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() dto: UpdateGoogleWorkspaceSettingsDto,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.updateFeatureEnabled(
      branch.branchId,
      dto.isFeatureEnabled,
      branch.tenantId,
    );
  }

  @Post('connect')
  async connect(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.startConnect(branch.branchId, user.id);
  }

  @Post('disconnect')
  async disconnect(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.disconnect(branch.branchId);
  }

  @Post('test-connection')
  async testConnection(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.testConnection(branch.branchId);
  }

  @Get('courses')
  async listCourses(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.listCourses(branch.branchId);
  }

  @Get('mappings')
  async listMappings(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.listMappings(branch.branchId);
  }

  @Post('mappings')
  async createMapping(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() dto: CreateGoogleCourseMappingDto,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.createMapping(
      dto,
      branch.branchId,
      user.id,
    );
  }

  @Post('mappings/auto-suggest')
  async autoSuggestMappings(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.autoSuggestMappings(branch.branchId);
  }

  @Delete('mappings/:id')
  async deleteMapping(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('id') id: string,
  ) {
    await this.ensureAdmin(user);
    return this.googleWorkspaceService.deleteMapping(id, branch.branchId);
  }

  @Get('coursework/:googleCourseId')
  async listCoursework(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('googleCourseId') googleCourseId: string,
  ) {
    await this.ensureFeatureEdit(user, branch.branchId);
    return this.googleWorkspaceService.listCoursework(
      branch.branchId,
      googleCourseId,
    );
  }

  @Get('sync-history')
  async getSyncHistory(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query() query: QuerySyncHistoryDto,
  ) {
    await this.ensureFeatureEdit(user, branch.branchId);
    return this.googleWorkspaceService.getSyncHistory(branch.branchId, query);
  }

  @Post('assessments/:id/link')
  async linkAssessment(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('id') id: string,
    @Body() dto: LinkAssessmentGoogleDto,
  ) {
    await this.ensureFeatureEdit(user, branch.branchId);
    return this.googleWorkspaceService.linkAssessment(
      id,
      dto.googleCourseworkId,
      branch.branchId,
      user.id,
      branch.tenantId,
    );
  }

  @Delete('assessments/:id/link')
  async unlinkAssessment(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('id') id: string,
  ) {
    await this.ensureFeatureEdit(user, branch.branchId);
    return this.googleWorkspaceService.unlinkAssessment(id, branch.branchId);
  }

  @Post('assessments/:id/pull-grades')
  async pullGrades(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('id') id: string,
  ) {
    await this.ensureFeatureEdit(user, branch.branchId);
    return this.googleWorkspaceService.pullGrades(
      id,
      branch.branchId,
      user.id,
    );
  }

  @Get('assessments/:id/sync-status')
  async getAssessmentSyncStatus(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
    @Param('id') id: string,
  ) {
    await this.ensureFeatureEdit(user, branch.branchId);
    return this.googleWorkspaceService.getAssessmentSyncStatus(
      id,
      branch.branchId,
    );
  }

  private ensureAdmin(user: CurrentUserPayload): void {
    const roles = user.roles || [];
    if (roles.some((r) => ADMIN_ROLES.has(r))) return;
    throw new ForbiddenException(
      'Only school administrators and principals can manage Google Classroom settings',
    );
  }

  private async ensureFeatureEdit(
    user: CurrentUserPayload,
    branchId: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.some((r) => ADMIN_ROLES.has(r))) return;
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
      .eq('code', FEATURE_CODE)
      .maybeSingle();
    if (!featureData) {
      throw new ForbiddenException(
        'Google Classroom integration feature is not configured',
      );
    }

    const { data: permissionRows } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) {
      throw new ForbiddenException(
        'You do not have edit access to Google Classroom integration',
      );
    }
  }
}
