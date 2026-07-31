import { Body, Controller, ForbiddenException, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { FeeChallanSettingsService } from './fee-challan-settings.service';
import { FeeChallanSettingsDto, UpsertFeeChallanSettingsDto } from './dto/fee-challan-settings.dto';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees/challan-settings')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class FeeChallanSettingsController {
  constructor(private readonly settingsService: FeeChallanSettingsService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (roles.includes('school_admin') || roles.includes('principal')) return;
    throw new ForbiddenException('Only school admin can manage fee settings');
  }

  @Get()
  async get(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: FeeChallanSettingsDto }> {
    this.ensureFeesAdmin(user);
    return this.settingsService.get(branch.branchId);
  }

  @Put()
  async upsert(
    @Body() dto: UpsertFeeChallanSettingsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: FeeChallanSettingsDto }> {
    this.ensureFeesAdmin(user);
    return this.settingsService.upsert(branch.branchId, dto);
  }
}

