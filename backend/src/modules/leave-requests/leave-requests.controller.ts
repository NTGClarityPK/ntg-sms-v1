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
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/leave-requests')
@UseGuards(JwtAuthGuard, BranchGuard)
export class LeaveRequestsController {
  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
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
  async listLeaveRequests(
    @Query() query: QueryLeaveRequestsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const isParent = user.roles?.includes('parent');
    const isStudent = user.roles?.includes('student');
    return this.leaveRequestsService.listLeaveRequests(
      query,
      user.id,
      branch.branchId,
      { isParent, isStudent },
    );
  }

  @Get(':id')
  async getLeaveRequestById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.getLeaveRequestById(
      id,
      branch.branchId,
      user.id,
      { isParent: user.roles?.includes('parent') ?? false, isStudent: user.roles?.includes('student') ?? false },
    );
    return { data };
  }

  @Post()
  async createLeaveRequest(
    @Body() input: CreateLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string; tenantId: string | null },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'leaves');
    const isParent = user.roles?.includes('parent') ?? false;
    const isStudent = user.roles?.includes('student') ?? false;
    const data = await this.leaveRequestsService.createLeaveRequest(
      input,
      user.id,
      branch.branchId,
      user.email,
      branch.tenantId,
      { isParent, isStudent },
    );
    return { data };
  }

  @Put(':id/approve')
  async approveLeaveRequest(
    @Param('id') id: string,
    @Body() input: UpdateLeaveStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string; tenantId: string | null },
  ) {
    const isParent = user.roles?.includes('parent');
    // Parents can approve if they have canApprove permission (checked in service)
    // Staff/admin need feature edit access
    if (!isParent) {
      await this.ensureFeatureEditAccess(user, branch.branchId, 'leaves');
    }
    const data = await this.leaveRequestsService.updateLeaveStatus(
      id,
      { ...input, status: 'approved' },
      user.id,
      branch.branchId,
      user.email,
      branch.tenantId,
      isParent,
    );
    return { data };
  }

  @Put(':id/reject')
  async rejectLeaveRequest(
    @Param('id') id: string,
    @Body() input: UpdateLeaveStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string; tenantId: string | null },
  ) {
    const isParent = user.roles?.includes('parent');
    // Parents can reject if they have canApprove permission (checked in service)
    // Staff/admin need feature edit access
    if (!isParent) {
      await this.ensureFeatureEditAccess(user, branch.branchId, 'leaves');
    }
    const data = await this.leaveRequestsService.updateLeaveStatus(
      id,
      { ...input, status: 'rejected' },
      user.id,
      branch.branchId,
      user.email,
      branch.tenantId,
      isParent,
    );
    return { data };
  }

  @Put(':id/cancel')
  async cancelLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string; tenantId: string | null },
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'leaves');
    const data = await this.leaveRequestsService.cancelLeaveRequest(
      id,
      user.id,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Get('quota/:studentId')
  async getStudentQuotaUsage(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.getStudentQuotaUsage(
      studentId,
      branch.branchId,
    );
    return { data };
  }

  @Get('stats/:studentId')
  async getLeaveStats(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.getLeaveStats(
      studentId,
      branch.branchId,
    );
    return { data };
  }
}


