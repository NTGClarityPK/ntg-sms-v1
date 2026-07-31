import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
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
}
