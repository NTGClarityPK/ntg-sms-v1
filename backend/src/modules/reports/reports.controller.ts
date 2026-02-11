import { Controller, Get, Param, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { StudentReportDto } from './dto/student-report.dto';
import { AcademicSectionDto } from './dto/academic-section.dto';
import { AttendanceSectionDto } from './dto/attendance-section.dto';
import { ClassReportDto } from './dto/class-report.dto';
import { RankingsDto } from './dto/rankings.dto';
import { QueryReportPeriodDto } from './dto/query-report-period.dto';
import { ClassStudentCountDto } from './dto/class-student-count.dto';

@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('student/:id/export/pdf')
  async exportStudentPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    const buffer = await this.reportsService.exportStudentReportPdf(
      id,
      branch.branchId,
      academicYearId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student-report-${id}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('student/:id/export/excel')
  async exportStudentExcel(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    const buffer = await this.reportsService.exportStudentReportExcel(
      id,
      branch.branchId,
      academicYearId,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="student-report-${id}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('student/:id')
  async getStudentReport(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
    @Query('periodType') periodType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<{ data: StudentReportDto }> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    const periodParams: QueryReportPeriodDto | undefined = periodType
      ? { periodType: periodType as any, startDate, endDate }
      : undefined;
    return this.reportsService.getStudentReport(id, branch.branchId, academicYearId, periodParams);
  }

  @Get('student/:id/academic')
  async getStudentAcademicReport(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: AcademicSectionDto }> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    return this.reportsService.getStudentAcademicReport(id, branch.branchId, academicYearId);
  }

  @Get('student/:id/attendance')
  async getStudentAttendanceReport(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: AttendanceSectionDto }> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    return this.reportsService.getStudentAttendanceReport(id, branch.branchId, academicYearId);
  }

  @Get('class/:classSectionId/export/excel')
  async exportClassExcel(
    @Param('classSectionId') classSectionId: string,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<void> {
    await this.reportsService.ensureTeacherCanAccessClassSection(
      classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const buffer = await this.reportsService.exportClassReportExcel(
      classSectionId,
      branch.branchId,
      academicYearId,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="class-report-${classSectionId}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('class/:classSectionId')
  async getClassReport(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: ClassReportDto }> {
    await this.reportsService.ensureTeacherCanAccessClassSection(
      classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    return this.reportsService.getClassReport(
      classSectionId,
      branch.branchId,
      academicYearId,
      user.id,
      user.roles,
    );
  }

  @Get('rankings/:classSectionId/:subjectId')
  async getRankings(
    @Param('classSectionId') classSectionId: string,
    @Param('subjectId') subjectId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: RankingsDto }> {
    return this.reportsService.getRankings(
      classSectionId,
      subjectId,
      branch.branchId,
      academicYearId,
    );
  }

  @Get('public/class-counts')
  @UseGuards(JwtAuthGuard)
  async getAllClassStudentCounts(
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: ClassStudentCountDto[] }> {
    return this.reportsService.getAllClassStudentCounts(branch.branchId, academicYearId);
  }

  @Get('public/class/:classSectionId/counts')
  @UseGuards(JwtAuthGuard)
  async getClassStudentCounts(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: ClassStudentCountDto }> {
    return this.reportsService.getClassStudentCounts(classSectionId, branch.branchId, academicYearId);
  }
}
