import { Body, Controller, ForbiddenException, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { LateFeeService } from './late-fee.service';
import { WaiveLateFeeDto } from './dto/waive-late-fee.dto';
import { QueryLateFeesDto } from './dto/query-late-fees.dto';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees/late-fees')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class LateFeeController {
  constructor(private readonly lateFeeService: LateFeeService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (roles.includes('school_admin') || roles.includes('principal')) return;
    throw new ForbiddenException('Only school admin can manage late fees');
  }

  @Get()
  async list(
    @Query() query: QueryLateFeesDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.lateFeeService.list(branch.branchId, query);
  }

  /** Backwards-compatible alias for older clients. */
  @Get('recent')
  async recent(@CurrentBranch() branch: CurrentBranchContext, @CurrentUser() user: CurrentUserPayload) {
    this.ensureFeesAdmin(user);
    return this.lateFeeService.list(branch.branchId, { page: 1, limit: 100, status: 'all', sortOrder: 'desc' });
  }

  @Put(':id/waive')
  async waive(
    @Param('id') id: string,
    @Body() body: WaiveLateFeeDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.lateFeeService.waive({
      lateFeeId: id,
      reason: body.reason,
      waivedBy: user.id,
      branchId: branch.branchId,
    });
  }
}
