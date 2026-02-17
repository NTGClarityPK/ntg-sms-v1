import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { QueryStaffDto } from './dto/query-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { DeactivateStaffDto } from './dto/deactivate-staff.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/staff')
@UseGuards(JwtAuthGuard, BranchGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
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

  @Get()
  async listStaff(
    @Query() query: QueryStaffDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.staffService.listStaff(query, branch.branchId);
  }

  @Get('me')
  async getMyStaff(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.getStaffByUserId(user.id, branch.branchId);
    if (!data) {
      return { data: null };
    }
    return { data };
  }

  @Get(':id')
  async getStaffById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.getStaffById(id, branch.branchId);
    return { data };
  }

  @Get(':id/assignments')
  async getAssignments(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.getAssignments(id, branch.branchId);
    return { data };
  }

  @Get(':id/schedule')
  async getSchedule(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.getAssignments(id, branch.branchId);
    return { data };
  }

  @Post()
  async createStaff(
    @Body() input: CreateStaffDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'staff');
    const data = await this.staffService.createStaff(input, branch.branchId, user.email);
    return { data };
  }

  @Put(':id')
  async updateStaff(
    @Param('id') id: string,
    @Body() input: UpdateStaffDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'staff');
    const data = await this.staffService.updateStaff(id, input, branch.branchId, user.email);
    return { data };
  }

  @Post(':id/deactivate')
  async deactivateStaff(
    @Param('id') id: string,
    @Body() input: DeactivateStaffDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'staff');
    const data = await this.staffService.deactivateStaff(id, input, branch.branchId, user.email);
    return { data };
  }
}

