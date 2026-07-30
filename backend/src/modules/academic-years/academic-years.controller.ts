import { Body, Controller, ForbiddenException, Get, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { hasPrivilegedAccess } from '../../common/utils/privileged-access.util';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { QueryAcademicYearsDto } from './dto/query-academic-years.dto';
import { AcademicYearDto } from './dto/academic-year.dto';
import { PromotionPlacementService } from '../promotion-placement/promotion-placement.service';
import { RolloverAcademicYearDto } from './dto/rollover-academic-year.dto';

@ApiTags('Academic years')
@Controller('api/v1/academic-years')
@UseGuards(JwtAuthGuard, BranchGuard)
export class AcademicYearsController {
  private readonly logger = new Logger(AcademicYearsController.name);

  constructor(
    private readonly academicYearsService: AcademicYearsService,
    private readonly promotionPlacementService: PromotionPlacementService,
  ) {}

  @Get()
  async list(
    @Query() query: QueryAcademicYearsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.academicYearsService.list(query, branch.tenantId, branch.branchId);
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
    const previousActive = await this.academicYearsService.getActive(branch.tenantId);
    const updated = await this.academicYearsService.activate(id, branch.tenantId, user.email);

    // If switching from one year to another, apply Promotion decisions into enrolments for the newly active year.
    // This ensures student placement screens and class rosters reflect the active year.
    if (previousActive?.id && previousActive.id !== id) {
      await this.academicYearsService.applyPromotionDecisionsToEnrolments({
        branchId: branch.branchId,
        sourceAcademicYearId: previousActive.id,
        targetAcademicYearId: id,
        userEmail: user.email,
      });
    }
    return { data: updated };
  }

  @Patch(':id/lock')
  async lock(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AcademicYearDto }> {
    // Block year close if Promotion & Placement is incomplete for active students.
    // (Applies especially to locking the active year.)
    const readiness = await this.promotionPlacementService.getReadiness(branch.branchId, id);
    if (readiness.decisionsMissing > 0) {
      throw new ForbiddenException(
        `Cannot lock academic year: ${readiness.decisionsMissing} student(s) are missing Promotion & Placement decisions.`,
      );
    }
    const updated = await this.academicYearsService.lock(id, branch.tenantId, branch.branchId, user.email);
    return { data: updated };
  }

  @Get(':id/readiness')
  async readiness(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    const data = await this.promotionPlacementService.getReadiness(branch.branchId, id);
    return { data };
  }

  @Post(':id/rollover')
  async rollover(
    @Param('id') sourceAcademicYearId: string,
    @Body() body: RolloverAcademicYearDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const readiness = await this.promotionPlacementService.getReadiness(
      branch.branchId,
      sourceAcademicYearId,
    );
    if (readiness.decisionsMissing > 0) {
      throw new ForbiddenException(
        `Cannot rollover academic year: ${readiness.decisionsMissing} student(s) are missing Promotion & Placement decisions.`,
      );
    }
    const data = await this.academicYearsService.rolloverAcademicYear({
      branchId: branch.branchId,
      tenantId: branch.tenantId,
      sourceAcademicYearId,
      targetAcademicYearId: body.targetAcademicYearId,
      carryForward: body.carryForward,
      userEmail: user.email,
      userId: user.id,
    });
    return { data };
  }

  // Admin-only endpoint for unlocking academic years
  @Patch('admin/:id/unlock')
  @UseGuards(JwtAuthGuard)
  async unlock(
    @Param('id') id: string,
    @Body() body: { tenantId: string },
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AcademicYearDto }> {
    if (
      !hasPrivilegedAccess({ email: user.email, roles: user.roles }, this.logger)
    ) {
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
    if (
      !hasPrivilegedAccess({ email: user.email, roles: user.roles }, this.logger)
    ) {
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


