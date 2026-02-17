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
import { UsersService } from './users.service';
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
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, BranchGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
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
  async listUsers(
    @Query() query: QueryUsersDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.usersService.listUsers(query, branch.branchId);
  }

  @Get(':id')
  async getUserById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.usersService.getUserById(id, branch.branchId);
    return { data };
  }

  @Post()
  async createUser(
    @Body() input: CreateUserDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'user_management');
    const data = await this.usersService.createUser(
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'user_management');
    const data = await this.usersService.updateUser(
      id,
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Put(':id/roles')
  async updateUserRoles(
    @Param('id') id: string,
    @Body() input: UpdateUserRolesDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'user_management');
    const data = await this.usersService.updateUserRoles(
      id,
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Delete(':id')
  async deleteUser(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'user_management');
    await this.usersService.deleteUser(
      id,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data: { success: true } };
  }
}

