import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { PromotionPlacementService } from './promotion-placement.service';
import { QueryPromotionStudentsDto } from './dto/query-promotion-students.dto';
import { SavePromotionDecisionsDto } from './dto/save-promotion-decisions.dto';

@Controller('api/v1/promotion-placement')
@UseGuards(JwtAuthGuard, BranchGuard)
export class PromotionPlacementController {
  constructor(
    private readonly promotionPlacementService: PromotionPlacementService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  @Get('students')
  async listStudents(
    @Query() query: QueryPromotionStudentsDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const activeYear =
      query.academicYearId ?? (await this.academicYearsService.getActiveForBranch(branch.branchId))?.id;
    if (!activeYear) {
      return { data: [] };
    }
    return this.promotionPlacementService.listStudentsForPromotion(
      branch.branchId,
      activeYear,
      query.classSectionId,
    );
  }

  @Post('decisions')
  async saveDecisions(
    @Body() body: SavePromotionDecisionsDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.promotionPlacementService.saveDecisions(
      branch.branchId,
      body.sourceAcademicYearId,
      user.id,
      body.decisions,
    );
    return { data: result };
  }
}

