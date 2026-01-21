import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
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
  ): Promise<{ data: TimingTemplateDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.scheduleService.listTimingTemplates(query);
  }

  @Post('timing-templates')
  async createTimingTemplate(@Body() body: CreateTimingTemplateDto): Promise<{ data: TimingTemplateDto }> {
    const created = await this.scheduleService.createTimingTemplate(body);
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
  async listHolidays(@Query('academicYearId') academicYearId: string): Promise<{ data: PublicHolidayDto[] }> {
    return this.scheduleService.listPublicHolidays(academicYearId);
  }

  @Post('public-holidays')
  async createHoliday(@Body() body: CreatePublicHolidayDto): Promise<{ data: PublicHolidayDto }> {
    const created = await this.scheduleService.createPublicHoliday(body);
    return { data: created };
  }

  @Put('public-holidays/:id')
  async updateHoliday(@Param('id') id: string, @Body() body: UpdatePublicHolidayDto): Promise<{ data: PublicHolidayDto }> {
    const updated = await this.scheduleService.updatePublicHoliday(id, body);
    return { data: updated };
  }

  @Delete('public-holidays/:id')
  async deleteHoliday(@Param('id') id: string): Promise<{ data: { id: string } }> {
    return this.scheduleService.deletePublicHoliday(id);
  }

  @Get('vacations')
  async listVacations(@Query('academicYearId') academicYearId: string): Promise<{ data: VacationDto[] }> {
    return this.scheduleService.listVacations(academicYearId);
  }

  @Post('vacations')
  async createVacation(@Body() body: CreateVacationDto): Promise<{ data: VacationDto }> {
    const created = await this.scheduleService.createVacation(body);
    return { data: created };
  }

  @Put('vacations/:id')
  async updateVacation(@Param('id') id: string, @Body() body: UpdateVacationDto): Promise<{ data: VacationDto }> {
    const updated = await this.scheduleService.updateVacation(id, body);
    return { data: updated };
  }

  @Delete('vacations/:id')
  async deleteVacation(@Param('id') id: string): Promise<{ data: { id: string } }> {
    return this.scheduleService.deleteVacation(id);
  }
}


