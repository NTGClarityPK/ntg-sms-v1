import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import type { CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { SettingsStatusService } from './settings-status.service';
import { SettingsStatusDto } from './dto/settings-status.dto';
import { CopySettingsDto } from './dto/settings-status.dto';

@Controller('api/v1/settings-status')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SettingsStatusController {
  constructor(private readonly settingsStatusService: SettingsStatusService) {}

  @Get('status')
  async getStatus(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: SettingsStatusDto }> {
    const status = await this.settingsStatusService.checkInitializationStatus(
      branch.branchId,
      branch.tenantId,
    );
    return { data: status };
  }

  @Get('branches-with-settings')
  async getBranchesWithSettings(
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: Array<{ id: string; name: string; code: string | null }> }> {
    const branches = await this.settingsStatusService.getBranchesWithSettings(
      branch.branchId,
      branch.tenantId,
    );
    return { data: branches };
  }

  @Post('copy-from-branch')
  async copyFromBranch(
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() body: CopySettingsDto,
  ): Promise<{ data: { message: string } }> {
    await this.settingsStatusService.copySettingsFromBranch(
      body.sourceBranchId,
      branch.branchId,
      branch.tenantId,
    );
    return { data: { message: 'Settings copied successfully' } };
  }
}

