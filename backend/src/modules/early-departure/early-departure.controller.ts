import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { EarlyDepartureService } from './early-departure.service';
import { CreateEarlyDepartureRequestDto } from './dto/create-early-departure.dto';
import { UpdateEarlyDepartureStatusDto } from './dto/update-early-departure-status.dto';
import { QueryEarlyDepartureRequestsDto } from './dto/query-early-departure.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/early-departures')
@UseGuards(JwtAuthGuard, BranchGuard)
export class EarlyDepartureController {
  constructor(
    private readonly earlyDepartureService: EarlyDepartureService,
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
  async listEarlyDepartureRequests(
    @Query() query: QueryEarlyDepartureRequestsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.earlyDepartureService.listEarlyDepartureRequests(
      query,
      user.id,
      branch.branchId,
    );
  }

  @Post()
  async createEarlyDepartureRequest(
    @Body() input: CreateEarlyDepartureRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'early_departure');
    const data = await this.earlyDepartureService.createEarlyDepartureRequest(
      input,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/approve')
  async approveEarlyDepartureRequest(
    @Param('id') id: string,
    @Body() input: UpdateEarlyDepartureStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'early_departure');
    const data = await this.earlyDepartureService.updateEarlyDepartureStatus(
      id,
      { ...input, status: 'approved' },
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/reject')
  async rejectEarlyDepartureRequest(
    @Param('id') id: string,
    @Body() input: UpdateEarlyDepartureStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'early_departure');
    const data = await this.earlyDepartureService.updateEarlyDepartureStatus(
      id,
      { ...input, status: 'rejected' },
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/cancel')
  async cancelEarlyDepartureRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'early_departure');
    const data = await this.earlyDepartureService.cancelEarlyDepartureRequest(
      id,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Get('check-conflict')
  async checkConflict(
    @Query('studentId') studentId: string,
    @Query('date') date: string,
    @Query('departureTime') departureTime: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const result = await this.earlyDepartureService.checkClassConflict(
      studentId,
      date,
      departureTime,
      branch.branchId,
    );
    return { data: result };
  }

  @Get('statistics')
  async getStatistics(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.earlyDepartureService.getStudentStatistics(
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Post('authorize')
  async authorizeEarlyDeparture(
    @Body() input: CreateEarlyDepartureRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'early_departure');
    const data = await this.earlyDepartureService.authorizeEarlyDeparture(
      input,
      user.id,
      branch.branchId,
    );
    return { data };
  }
}



