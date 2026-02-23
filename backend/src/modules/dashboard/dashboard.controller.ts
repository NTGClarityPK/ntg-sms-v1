import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { UpdateDashboardPreferencesDto } from './dto/update-dashboard-preferences.dto';
import { QueryWidgetsDto } from './dto/query-widgets.dto';

@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, BranchGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('widgets')
  getWidgets(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryWidgetsDto,
  ) {
    const roles = user.roles ?? [];
    const widgets = this.dashboardService.getWidgetsForRoles(roles, query.role);
    return { data: widgets };
  }

  @Put('preferences')
  async savePreferences(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
    @Body() body: UpdateDashboardPreferencesDto,
  ) {
    const prefs = await this.dashboardService.savePreferences(
      user.id,
      branch.branchId,
      {
        widgetIds: body.widgetIds,
        selectedRoleId: body.selectedRoleId,
        layout: body.layout,
      },
    );
    return { data: prefs };
  }

  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const prefs = await this.dashboardService.getPreferences(
      user.id,
      branch.branchId,
    );
    return { data: prefs };
  }

  @Get()
  async getDashboard(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const roles = user.roles ?? [];
    const data = await this.dashboardService.getDashboardData(
      user.id,
      branch.branchId,
      roles,
    );
    return { data };
  }
}
