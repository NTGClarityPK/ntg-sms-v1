import { Body, Controller, ForbiddenException, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ResultReportSettingsService } from './result-report-settings.service';
import { ResultReportSettingsDto, UpsertResultReportSettingsDto } from './dto/result-report-settings.dto';

@ApiTags('Results')
@Controller('api/v1/results/report-settings')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ResultReportSettingsController {
  constructor(private readonly settingsService: ResultReportSettingsService) {}

  private ensureResultsSettingsAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (
      roles.includes('school_admin') ||
      roles.includes('principal')
    ) {
      return;
    }
    throw new ForbiddenException('Only school admin or principal can manage result report settings');
  }

  @Get()
  async get(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultReportSettingsDto }> {
    this.ensureResultsSettingsAdmin(user);
    return this.settingsService.get(branch.branchId);
  }

  @Put()
  async upsert(
    @Body() dto: UpsertResultReportSettingsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultReportSettingsDto }> {
    this.ensureResultsSettingsAdmin(user);
    return this.settingsService.upsert(branch.branchId, dto);
  }
}
