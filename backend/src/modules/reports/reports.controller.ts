import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { StudentReportDto } from './dto/student-report.dto';
import { AcademicSectionDto } from './dto/academic-section.dto';
import { AttendanceSectionDto } from './dto/attendance-section.dto';
import { ClassReportDto } from './dto/class-report.dto';
import { RankingsDto } from './dto/rankings.dto';
import { QueryReportPeriodDto } from './dto/query-report-period.dto';
import { ClassStudentCountDto } from './dto/class-student-count.dto';
import { AttendanceReportByClassDto } from './dto/attendance-report-by-class.dto';
import { AttendanceSummaryBranchDto } from './dto/attendance-summary-branch.dto';
import { LowAttendanceReportDto } from './dto/low-attendance.dto';
import { AcademicReportBySubjectDto } from './dto/academic-report-by-subject.dto';
import { AcademicComparisonDto } from './dto/academic-comparison.dto';

@ApiTags('Reports')
@Controller('api/v1/reports')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  @Get('student/:id/export/pdf')
  async exportStudentPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
    @Query('include') include?: string,
    @Query('exclude') exclude?: string,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    const buffer = await this.reportsService.exportStudentReportPdf(
      id,
      branch.branchId,
      academicYearId,
      { include, exclude },
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
    @Query('include') include?: string,
    @Query('exclude') exclude?: string,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(id, user.id, user.roles);
    const buffer = await this.reportsService.exportStudentReportExcel(
      id,
      branch.branchId,
      academicYearId,
      { include, exclude },
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

  // --- Administrative Attendance Reports (route order: specific before :param) ---
  @Get('attendance/summary')
  async getAttendanceSummary(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<{ data: AttendanceSummaryBranchDto }> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    return this.reportsService.getAttendanceSummaryBranch(
      branch.branchId,
      startDate,
      endDate,
      user.id,
      user.roles,
    );
  }

  @Get('attendance/low-attendance')
  async getLowAttendance(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('threshold') threshold?: string,
  ): Promise<{ data: LowAttendanceReportDto }> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const thresholdNum = threshold != null ? parseInt(threshold, 10) : 80;
    return this.reportsService.getLowAttendanceStudents(
      branch.branchId,
      startDate,
      endDate,
      isNaN(thresholdNum) ? 80 : Math.min(100, Math.max(1, thresholdNum)),
      user.id,
      user.roles,
    );
  }

  @Get('attendance/export')
  async exportAttendanceReport(
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('format') format: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classSectionId') classSectionId?: string,
    @Query('include') include?: string,
    @Query('exclude') exclude?: string,
  ): Promise<void> {
    if (!startDate || !endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const isPdf = (format || 'pdf').toLowerCase() === 'pdf';
    const buffer = isPdf
      ? await this.reportsService.exportAttendanceReportPdf(
          branch.branchId,
          academicYearId,
          startDate,
          endDate,
          classSectionId,
          user.id,
          user.roles,
          { include, exclude },
        )
      : await this.reportsService.exportAttendanceReportExcel(
          branch.branchId,
          academicYearId,
          startDate,
          endDate,
          classSectionId,
          user.id,
          user.roles,
        );
    if (isPdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance-report-${classSectionId ?? 'branch'}.pdf"`,
      );
    } else {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="attendance-report-${classSectionId ?? 'branch'}.xlsx"`,
      );
    }
    res.send(buffer);
  }

  @Get('academic/comparison')
  async getAcademicComparison(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
    @Query('classSectionIds') classSectionIds?: string,
    @Query('subjectIds') subjectIds?: string,
  ): Promise<{ data: AcademicComparisonDto }> {
    const csIds = classSectionIds ? classSectionIds.split(',').filter(Boolean) : undefined;
    const subIds = subjectIds ? subjectIds.split(',').filter(Boolean) : undefined;
    return this.reportsService.getAcademicComparison(
      branch.branchId,
      academicYearId,
      csIds,
      subIds,
      user.id,
      user.roles,
    );
  }

  @Get('academic/export')
  async exportAcademicReport(
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('format') format: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classSectionId') classSectionId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('include') include?: string,
    @Query('exclude') exclude?: string,
  ): Promise<void> {
    const isPdf = (format || 'pdf').toLowerCase() === 'pdf';
    const buffer = isPdf
      ? await this.reportsService.exportAcademicReportPdf(
          branch.branchId,
          academicYearId,
          classSectionId,
          subjectId,
          user.id,
          user.roles,
          { include, exclude },
        )
      : await this.reportsService.exportAcademicReportExcel(
          branch.branchId,
          academicYearId,
          classSectionId,
          subjectId,
          user.id,
          user.roles,
        );
    if (isPdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="academic-report-${classSectionId ?? subjectId ?? 'report'}.pdf"`,
      );
    } else {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="academic-report-${classSectionId ?? subjectId ?? 'report'}.xlsx"`,
      );
    }
    res.send(buffer);
  }

  @Get('academic/class/:classSectionId')
  async getAcademicReportByClass(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: ClassReportDto }> {
    return this.reportsService.getAcademicReportByClass(
      classSectionId,
      branch.branchId,
      academicYearId,
      user.id,
      user.roles,
    );
  }

  @Get('academic/subject/:subjectId')
  async getAcademicReportBySubject(
    @Param('subjectId') subjectId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: AcademicReportBySubjectDto }> {
    return this.reportsService.getAcademicReportBySubject(
      subjectId,
      branch.branchId,
      academicYearId,
      user.id,
      user.roles,
    );
  }

  @Get('attendance/class/:classSectionId')
  async getAttendanceReportByClass(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: { id: string; roles?: string[] },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: AttendanceReportByClassDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(branch.branchId);
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const yearId = academicYearId ?? activeYear.id;
    const start = startDate ?? activeYear.startDate.split('T')[0];
    const end = endDate ?? activeYear.endDate.split('T')[0];
    return this.reportsService.getAttendanceReportByClass(
      classSectionId,
      branch.branchId,
      yearId,
      start,
      end,
      user.id,
      user.roles,
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
