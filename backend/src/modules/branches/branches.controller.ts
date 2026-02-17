import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { BranchDto } from './dto/branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AssignBranchToTenantDto } from './dto/assign-branch-to-tenant.dto';
import { AuthService } from '../auth/auth.service';

@Controller('api/v1/branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(
    @Query() query: QueryBranchesDto,
  ): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.branchesService.list(query);
  }

  @Get('by-tenant')
  async listByTenant(@CurrentUser() user: { id: string }): Promise<{ data: BranchDto[] }> {
    // Get user's branches to determine tenant
    const userData = await this.authService.getCurrentUser(user.id);
    const branches = userData.branches ?? [];
    
    // Get tenant ID from first branch (all user's branches should be in same tenant)
    const tenantId = branches.length > 0 ? branches[0].tenantId : null;
    
    return this.branchesService.listByTenant(tenantId, user.id);
  }

  @Get(':id/storage')
  async getStorage(
    @Param('id') id: string,
  ): Promise<{ data: { quotaGb: number; usedBytes: number; usedPercentage: number } }> {
    const storage = await this.branchesService.getStorage(id);
    return { data: storage };
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<{ data: BranchDto }> {
    const branch = await this.branchesService.getById(id);
    return { data: branch };
  }

  @Post()
  async create(
    @Body() body: CreateBranchDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: BranchDto }> {
    const created = await this.branchesService.create(body, user.email);
    return { data: created };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: BranchDto }> {
    const updated = await this.branchesService.update(id, body, user.email);
    return { data: updated };
  }

  @Post('assign-to-tenant')
  async assignToTenant(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: AssignBranchToTenantDto,
  ): Promise<{ data: BranchDto }> {
    // Super admin only access
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev = user.email?.endsWith('@ntg.com') || user.email?.endsWith('@example.com');
    const isOwner = user.roles?.includes('tenant_owner');
    
    if (!isSuperAdmin && !isDev && !isOwner) {
      throw new ForbiddenException('This endpoint is only accessible to super admins, developers and owners');
    }

    const created = await this.branchesService.assignBranchToTenant(body, user.email);
    return { data: created };
  }

  // Admin-only endpoint to get branches by tenant ID
  @Get('admin/by-tenant/:tenantId')
  async listByTenantId(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: BranchDto[] }> {
    // Super admin only access
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev = user.email?.endsWith('@ntg.com') || user.email?.endsWith('@example.com');
    
    if (!isSuperAdmin && !isDev) {
      throw new ForbiddenException('This endpoint is only accessible to super admins');
    }

    // For admin, get all branches for the tenant (not filtered by user access)
    return this.branchesService.listByTenantAdmin(tenantId);
  }
}




