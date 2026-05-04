import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ScheduleService } from './schedule.service';
import { UpdateSchoolDaysDto } from './dto/update-school-days.dto';
import { QueryTimingTemplatesDto } from './dto/query-timing-templates.dto';
import { TimingTemplateDto } from './dto/timing-template.dto';
import { CreateTimingTemplateDto } from './dto/create-timing-template.dto';
import { AssignClassesDto } from './dto/assign-classes.dto';
import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { PublicHolidayDto } from './dto/public-holiday.dto';
import { VacationDto } from './dto/vacation.dto';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { UpdateVacationDto } from './dto/update-vacation.dto';

@ApiTags('Schedule & calendar')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('settings/school-days')
  async getSchoolDays(): Promise<{ data: number[] }> {
    return this.scheduleService.getSchoolDays();
  }

  @Put('settings/school-days')
  async updateSchoolDays(@Body() body: UpdateSchoolDaysDto): Promise<{ data: number[] }> {
    return this.scheduleService.updateSchoolDays(body.activeDays);
  }

  @Get('timing-templates')
  async listTimingTemplates(
    @Query() query: QueryTimingTemplatesDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: TimingTemplateDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.scheduleService.listTimingTemplates(query, branch.branchId);
  }

  @Post('timing-templates')
  async createTimingTemplate(
    @Body() body: CreateTimingTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: TimingTemplateDto }> {
    const created = await this.scheduleService.createTimingTemplate(
      body,
      branch.branchId,
      branch.tenantId,
      user.email,
    );
    return { data: created };
  }

  @Put('timing-templates/:id/assign-classes')
  async assignClasses(
    @Param('id') id: string,
    @Body() body: AssignClassesDto,
  ): Promise<{ data: string[] }> {
    return this.scheduleService.assignClassesToTimingTemplate(id, body.classIds);
  }

  @Get('public-holidays')
  async listHolidays(
    @Query('academicYearId') academicYearId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: PublicHolidayDto[] }> {
    return this.scheduleService.listPublicHolidays(academicYearId, branch.branchId);
  }

  @Post('public-holidays')
  async createHoliday(
    @Body() body: CreatePublicHolidayDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: PublicHolidayDto }> {
    const created = await this.scheduleService.createPublicHoliday(
      body,
      branch.branchId,
      branch.tenantId,
      user.email,
    );
    return { data: created };
  }

  @Put('public-holidays/:id')
  async updateHoliday(
    @Param('id') id: string,
    @Body() body: UpdatePublicHolidayDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: PublicHolidayDto }> {
    const updated = await this.scheduleService.updatePublicHoliday(
      id,
      body,
      user.email,
      branch.branchId,
      branch.tenantId,
    );
    return { data: updated };
  }

  @Delete('public-holidays/:id')
  async deleteHoliday(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    return this.scheduleService.deletePublicHoliday(id, user.email, branch.branchId, branch.tenantId);
  }

  @Get('vacations')
  async listVacations(@Query('academicYearId') academicYearId: string): Promise<{ data: VacationDto[] }> {
    return this.scheduleService.listVacations(academicYearId);
  }

  @Post('vacations')
  async createVacation(
    @Body() body: CreateVacationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: VacationDto }> {
    const created = await this.scheduleService.createVacation(body, user.email);
    return { data: created };
  }

  @Put('vacations/:id')
  async updateVacation(
    @Param('id') id: string,
    @Body() body: UpdateVacationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: VacationDto }> {
    const updated = await this.scheduleService.updateVacation(id, body, user.email);
    return { data: updated };
  }

  @Delete('vacations/:id')
  async deleteVacation(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    return this.scheduleService.deleteVacation(id, user.email);
  }
}


