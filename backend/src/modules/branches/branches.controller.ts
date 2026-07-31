import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { BranchDto } from './dto/branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { UpdatePublicStatsDto } from './dto/update-public-stats.dto';
import { AuthService } from '../auth/auth.service';

@ApiTags('Tenants & branches')
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
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.branchesService.list(query, {
      userId: user.id,
      roles: user.roles,
    });
  }

  @Get('by-tenant')
  async listByTenant(
    @CurrentUser() user: { id: string },
    @Query('language') language?: 'en' | 'en-US' | 'en-GB' | 'ar',
  ): Promise<{ data: BranchDto[] }> {
    const userData = await this.authService.getCurrentUser(user.id);
    const branches = userData.branches ?? [];

    const tenantId = branches.length > 0 ? branches[0].tenantId : null;

    return this.branchesService.listByTenant(tenantId, user.id, language ?? 'en-GB');
  }

  @Put(':id/public-stats')
  async updatePublicStats(
    @Param('id') id: string,
    @Body() body: UpdatePublicStatsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { success: boolean } }> {
    const roleNames = user.roles || [];
    const canEdit =
      roleNames.includes('school_admin') ||
      roleNames.includes('principal');
    if (!canEdit) {
      throw new ForbiddenException('Only school admin or principal can update public statistics');
    }
    await this.branchesService.updatePublicStats(
      id,
      body.enabled,
      body.password,
      user.email ?? '',
      {
        userId: user.id,
        email: user.email ?? '',
        roles: user.roles,
      },
    );
    return { data: { success: true } };
  }

  @Get(':id/storage')
  async getStorage(
    @Param('id') id: string,
  ): Promise<{ data: { quotaGb: number; usedBytes: number; usedPercentage: number } }> {
    const storage = await this.branchesService.getStorage(id);
    return { data: storage };
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('language') language?: 'en' | 'en-US' | 'en-GB' | 'ar',
  ): Promise<{ data: BranchDto }> {
    const branch = await this.branchesService.getById(id, language ?? 'en-GB', {
      userId: user.id,
      email: user.email ?? '',
      roles: user.roles,
    });
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
    const updated = await this.branchesService.update(id, body, user.email, {
      userId: user.id,
      email: user.email ?? '',
      roles: user.roles,
    });
    return { data: updated };
  }
}
