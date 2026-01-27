import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';

@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, BranchGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  @Get()
  async listAttendance(
    @Query() query: QueryAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    return this.attendanceService.listAttendance(
      query,
      branch.branchId,
      query.academicYearId || activeYear.id,
    );
  }

  @Get('class/:classSectionId/date/:date')
  async getAttendanceByClassAndDate(
    @Param('classSectionId') classSectionId: string,
    @Param('date') date: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.getAttendanceByClassAndDate(
      classSectionId,
      date,
      branch.branchId,
      academicYearId || activeYear.id,
    );
    return { data };
  }

  @Post('bulk')
  async bulkMarkAttendance(
    @Body() input: BulkMarkAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: { id: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.bulkMarkAttendance(
      input,
      branch.branchId,
      academicYearId || activeYear.id,
      user.id,
    );
    return { data };
  }

  @Put(':id')
  async updateAttendance(
    @Param('id') id: string,
    @Body() input: UpdateAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.attendanceService.updateAttendance(
      id,
      input,
      branch.branchId,
      user.id,
    );
    return { data };
  }

  @Get('student/:studentId')
  async getAttendanceByStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.getAttendanceByStudent(
      studentId,
      branch.branchId,
      academicYearId || activeYear.id,
      startDate,
      endDate,
    );
    return { data };
  }

  @Get('summary/student/:studentId')
  async getAttendanceSummaryByStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.getAttendanceSummaryByStudent(
      studentId,
      branch.branchId,
      academicYearId || activeYear.id,
    );
    return { data };
  }

  @Get('summary/class/:classSectionId')
  async getAttendanceSummaryByClass(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.getAttendanceSummaryByClass(
      classSectionId,
      branch.branchId,
      academicYearId || activeYear.id,
      startDate,
      endDate,
    );
    return { data };
  }

  @Get('report')
  async generateAttendanceReport(
    @Query() query: QueryAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.generateAttendanceReport(
      query,
      branch.branchId,
      query.academicYearId || activeYear.id,
    );
    return { data };
  }
}


