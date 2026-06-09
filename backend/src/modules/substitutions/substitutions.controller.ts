import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SupabaseConfig } from '../../common/config/supabase.config';
import { SubstitutionsService } from './substitutions.service';
import { SuggestSubstitutionsDto } from './dto/suggest-substitutions.dto';
import { AssignSubstitutionsDto } from './dto/assign-substitutions.dto';
import { QuerySubstitutionsDto } from './dto/query-substitutions.dto';
import { QuerySubstitutionLoadStatsDto } from './dto/query-substitution-load-stats.dto';
import { QuerySubstitutionOverlaysDto } from './dto/query-substitution-overlays.dto';

const FEATURE_CODE = 'teacher_substitution';

@ApiTags('Substitutions')
@Controller('api/v1/substitutions')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SubstitutionsController {
  constructor(
    private readonly substitutionsService: SubstitutionsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
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
      .eq('code', FEATURE_CODE)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(`${FEATURE_CODE} permission feature not configured`);
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${FEATURE_CODE} edit permissions`);
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) {
      throw new ForbiddenException(`You do not have edit access to ${FEATURE_CODE}`);
    }
  }

  private async ensureFeatureViewAccess(
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
      .eq('code', FEATURE_CODE)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(`${FEATURE_CODE} permission feature not configured`);
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${FEATURE_CODE} permissions`);
    }

    const allowed = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit' || row.permission === 'view',
    );
    if (!allowed) {
      throw new ForbiddenException(`You do not have access to ${FEATURE_CODE}`);
    }
  }

  @Post('suggest')
  async suggest(
    @Body() body: SuggestSubstitutionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.substitutionsService.suggest(body, branch.branchId);
  }

  @Post('assign')
  async assign(
    @Body() body: AssignSubstitutionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.substitutionsService.assign(body, branch.branchId, user.id, user.email);
  }

  @Get('history/export')
  async exportHistory(
    @Query() query: QuerySubstitutionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
  ): Promise<void> {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    const csv = await this.substitutionsService.exportHistoryCsv(query, branch.branchId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="substitution-history.csv"');
    res.send(csv);
  }

  @Get('history')
  async history(
    @Query() query: QuerySubstitutionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureViewAccess(user, branch.branchId);
    return this.substitutionsService.listHistory(query, branch.branchId);
  }

  @Get('overlays')
  async overlays(
    @Query() query: QuerySubstitutionOverlaysDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureViewAccess(user, branch.branchId);
    return this.substitutionsService.getOverlays(query, branch.branchId);
  }

  @Get('load-stats')
  async loadStats(
    @Query() query: QuerySubstitutionLoadStatsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.substitutionsService.getLoadStats(query, branch.branchId);
  }

  @Get('me')
  async listMine(
    @Query() query: QuerySubstitutionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const staffId = await this.substitutionsService.resolveStaffIdForUser(
      user.id,
      branch.branchId,
    );
    if (!staffId) {
      return {
        data: [],
        meta: { total: 0, page: query.page ?? 1, limit: query.limit ?? 20, totalPages: 0 },
      };
    }
    return this.substitutionsService.listMine(staffId, query, branch.branchId);
  }

  @Get()
  async list(
    @Query() query: QuerySubstitutionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureViewAccess(user, branch.branchId);
    return this.substitutionsService.list(query, branch.branchId);
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId);
    return this.substitutionsService.cancel(id, branch.branchId, user.email);
  }
}
