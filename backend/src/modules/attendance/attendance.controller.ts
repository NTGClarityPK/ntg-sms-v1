import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { QueryAttendanceDto } from './dto/query-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { SupabaseConfig } from '../../common/config/supabase.config';
import type { Response } from 'express';

@ApiTags('Attendance')
@Controller('api/v1/attendance')
@UseGuards(JwtAuthGuard, BranchGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly academicYearsService: AcademicYearsService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) {
      throw new ForbiddenException('No role assigned for this user');
    }

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) {
      throw new ForbiddenException('Unable to verify role permissions');
    }
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) {
      throw new ForbiddenException('No valid role found for this user');
    }

    const { data: featureData, error: featureError } = await supabase
      .from('features')
      .select('id')
      .eq('code', featureCode)
      .maybeSingle();
    if (featureError || !featureData) {
      throw new ForbiddenException(`${featureCode} permission feature not configured`);
    }

    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .eq('feature_id', (featureData as { id: string }).id)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${featureCode} edit permissions`);
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) {
      throw new ForbiddenException(`You do not have edit access to ${featureCode}`);
    }
  }

  @Get()
  async listAttendance(
    @Query() query: QueryAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    return this.attendanceService.listAttendance(
      query,
      branch.branchId,
      query.academicYearId || activeYear.id,
      user,
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
    @CurrentUser() user: CurrentUserPayload,
    @Query('academicYearId') academicYearId?: string,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'attendance');
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.bulkMarkAttendance(
      input,
      branch.branchId,
      academicYearId || activeYear.id,
      user.id,
      user.email,
    );
    return { data };
  }

  @Put(':id')
  async updateAttendance(
    @Param('id') id: string,
    @Body() input: UpdateAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'attendance');
    const data = await this.attendanceService.updateAttendance(
      id,
      input,
      branch.branchId,
      user.id,
      user.email,
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
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }
    const data = await this.attendanceService.generateAttendanceReport(
      query,
      branch.branchId,
      query.academicYearId || activeYear.id,
      user,
    );
    return { data };
  }

  @Get('export')
  async exportAttendance(
    @Res() res: Response,
    @Query() query: QueryAttendanceDto,
    @CurrentBranch() branch: { branchId: string },
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new Error('No active academic year found');
    }

    const buffer = await this.attendanceService.exportAttendanceExcel(
      query,
      branch.branchId,
      query.academicYearId || activeYear.id,
      user,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-history.xlsx"`,
    );
    res.send(buffer);
  }
}


