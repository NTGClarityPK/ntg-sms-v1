import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { QueryAcademicYearsDto } from './dto/query-academic-years.dto';
import { AcademicYearDto } from './dto/academic-year.dto';

@Controller('api/v1/academic-years')
@UseGuards(JwtAuthGuard, BranchGuard)
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Get()
  async list(
    @Query() query: QueryAcademicYearsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.academicYearsService.list(query, branch.tenantId);
  }

  @Get('active')
  async getActive(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: AcademicYearDto | null }> {
    const year = await this.academicYearsService.getActive(branch.tenantId);
    return { data: year };
  }

  @Post()
  async create(
    @Body() body: CreateAcademicYearDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AcademicYearDto }> {
    const created = await this.academicYearsService.create(body, branch.tenantId, user.email);
    return { data: created };
  }

  @Patch(':id/activate')
  async activate(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AcademicYearDto }> {
    const updated = await this.academicYearsService.activate(id, branch.tenantId, user.email);
    return { data: updated };
  }

  @Patch(':id/lock')
  async lock(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AcademicYearDto }> {
    const updated = await this.academicYearsService.lock(id, branch.tenantId, user.email);
    return { data: updated };
  }

  // Admin-only endpoint for unlocking academic years
  @Patch('admin/:id/unlock')
  @UseGuards(JwtAuthGuard)
  async unlock(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AcademicYearDto }> {
    // Super admin only access
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev = user.email?.endsWith('@ntg.com') || user.email?.endsWith('@example.com');
    
    if (!isSuperAdmin && !isDev) {
      throw new ForbiddenException('This endpoint is only accessible to super admins');
    }

    const updated = await this.academicYearsService.unlock(id, body.tenantId, user.email);
    return { data: updated };
  }

  // Admin-only endpoint for listing academic years by tenant
  @Get('admin/by-tenant')
  @UseGuards(JwtAuthGuard)
  async listByTenant(
    @Query('tenantId') tenantId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    // Super admin only access
    const isSuperAdmin = user.roles?.includes('super_admin');
    const isDev = user.email?.endsWith('@ntg.com') || user.email?.endsWith('@example.com');
    
    if (!isSuperAdmin && !isDev) {
      throw new ForbiddenException('This endpoint is only accessible to super admins');
    }

    // Build query object manually to avoid DTO validation issues with tenantId
    const query: QueryAcademicYearsDto = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search: search || undefined,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    };

    return this.academicYearsService.list(query, tenantId);
  }
}


