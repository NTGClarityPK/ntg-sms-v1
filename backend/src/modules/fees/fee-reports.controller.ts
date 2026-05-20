import { Controller, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { FeeReportsService } from './fee-reports.service';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees/reports')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class FeeReportsController {
  constructor(private readonly feeReportsService: FeeReportsService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (roles.includes('school_admin') || roles.includes('super_admin') || roles.includes('principal')) return;
    throw new ForbiddenException('Only school admin can view fee reports');
  }

  @Get('collection')
  async collection(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.ensureFeesAdmin(user);
    return this.feeReportsService.getCollectionDashboard(branch.branchId, startDate, endDate);
  }

  @Get('defaulters')
  async defaulters(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.feeReportsService.getDefaulters(branch.branchId);
  }

  @Get('discounts')
  async discounts(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.ensureFeesAdmin(user);
    return this.feeReportsService.getDiscountSummary(branch.branchId, startDate, endDate);
  }

  @Get('monthly')
  async monthly(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
    @Query('months') months?: string,
  ) {
    this.ensureFeesAdmin(user);
    const list = (months ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.feeReportsService.getMonthlyReconciliation(branch.branchId, list);
  }
}

