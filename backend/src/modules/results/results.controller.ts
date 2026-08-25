import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  Res,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import type { CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ResultsService } from './results.service';
import { ReportsService } from '../reports/reports.service';
import { StudentResultDto } from './dto/student-result.dto';
import { ClassSectionResultsDto } from './dto/class-section-results.dto';
import { ResultCardDto } from './dto/result-card.dto';
import { GenerateResultDto } from './dto/generate-result.dto';
import { UpdateResultStatusDto } from './dto/update-result-status.dto';
import { UpdateResultCommentDto } from './dto/update-result-comment.dto';
import type { ResultType } from './dto/result-type.enum';
import type { ReportKind } from './dto/report-kind.enum';
import { RecordResultCardDeliveryDto } from './dto/record-result-card-delivery.dto';

function parseReportKindParam(value: string | undefined): ReportKind {
  if (value === 'annual_report' || value === 'progress_report') return value;
  return 'term_report';
}

@ApiTags('Results')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/results')
export class ResultsController {
  constructor(
    private readonly resultsService: ResultsService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get('student/:studentId/behavioral-report/pdf')
  async getBehavioralReportPdf(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(
      studentId,
      user.id,
      user.roles,
    );
    const buffer = await this.resultsService.generateBehavioralReportPdf(
      studentId,
      branch.branchId,
      academicYearId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="behavioral-report-${studentId}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('student/:studentId/result-card/pdf')
  async getResultCardPdf(
    @Param('studentId') studentId: string,
    @Query('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string,
    @Query('reportType') reportTypeParam: string | undefined,
    @Query('pdfVariant') pdfVariantParam: string | undefined,
    @Query('reportKind') reportKindParam: string | undefined,
    @Query('progressMonth') progressMonthParam: string | undefined,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(
      studentId,
      user.id,
      user.roles,
    );
    if (!classSectionId) {
      throw new ForbiddenException('classSectionId is required');
    }
    const type = (resultType === 'interim' || resultType === 'mid_term' || resultType === 'final'
      ? resultType
      : 'final') as ResultType;
    const reportType =
      reportTypeParam === 'detailed' ? ('detailed' as const) : ('basic' as const);
    const pdfVariant =
      pdfVariantParam === 'minimal' || pdfVariantParam === 'modern' ? pdfVariantParam : undefined;
    const reportKind = parseReportKindParam(reportKindParam);
    const progressMonthRaw = progressMonthParam ? Number(progressMonthParam) : undefined;
    const progressMonth =
      progressMonthRaw != null &&
      Number.isInteger(progressMonthRaw) &&
      progressMonthRaw >= 1 &&
      progressMonthRaw <= 12
        ? progressMonthRaw
        : undefined;
    const buffer = await this.resultsService.generateResultCardPdf(
      studentId,
      classSectionId,
      branch.branchId,
      academicYearId,
      type,
      { reportType, pdfVariant, reportKind, progressMonth },
    );
    const filename = await this.resultsService.buildResultCardFilename(
      studentId,
      classSectionId,
      branch.branchId,
      academicYearId,
      reportType,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(buffer);
  }

  @Get('student/:studentId/monthly-pack/attendance/pdf')
  async getMonthlyPackAttendancePdf(
    @Param('studentId') studentId: string,
    @Query('month') monthParam: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(
      studentId,
      user.id,
      user.roles,
    );
    const month = Number(monthParam);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be an integer from 1 to 12');
    }
    const buffer = await this.resultsService.generateMonthlyPackAttendancePdf(
      studentId,
      branch.branchId,
      academicYearId,
      month,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${monthParam}-${studentId}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('student/:studentId/monthly-pack/behaviour/pdf')
  async getMonthlyPackBehaviourPdf(
    @Param('studentId') studentId: string,
    @Query('month') monthParam: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.reportsService.ensureUserCanAccessStudent(
      studentId,
      user.id,
      user.roles,
    );
    const month = Number(monthParam);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('month must be an integer from 1 to 12');
    }
    const buffer = await this.resultsService.generateMonthlyPackBehaviourPdf(
      studentId,
      branch.branchId,
      academicYearId,
      month,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="behaviour-${monthParam}-${studentId}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('student/:studentId')
  async getResultForStudent(
    @Param('studentId') studentId: string,
    @Query('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: StudentResultDto }> {
    await this.reportsService.ensureUserCanAccessStudent(
      studentId,
      user.id,
      user.roles,
    );
    if (!classSectionId) {
      throw new ForbiddenException('classSectionId is required');
    }
    const type = (resultType === 'interim' || resultType === 'mid_term' || resultType === 'final'
      ? resultType
      : 'final') as ResultType;
    const data = await this.resultsService.getResultForStudent(
      studentId,
      classSectionId,
      branch.branchId,
      academicYearId,
      type,
    );
    return { data };
  }

  @Post('generate')
  async generateResult(
    @Body() body: GenerateResultDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultCardDto }> {
    await this.reportsService.ensureUserCanAccessStudent(
      body.studentId,
      user.id,
      user.roles,
    );
    await this.reportsService.ensureTeacherCanAccessClassSection(
      body.classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const reportKind = body.reportKind ?? 'term_report';
    if (reportKind === 'annual_report') {
      throw new BadRequestException('Annual reports can no longer be created');
    }
    if (reportKind === 'term_report' && !body.resultType) {
      throw new BadRequestException('resultType is required for term reports');
    }
    if (reportKind === 'progress_report') {
      const month = body.progressSequence;
      if (month == null || month < 1 || month > 12) {
        throw new BadRequestException(
          'progressSequence (calendar month 1–12) is required for progress reports',
        );
      }
    }
    const type = (body.resultType ?? 'final') as ResultType;
    const data = await this.resultsService.generateResultCard(
      body.studentId,
      body.classSectionId,
      branch.branchId,
      body.academicYearId,
      type,
      user.id,
      {
        reportKind,
        progressSequence: body.progressSequence,
      },
    );
    return { data };
  }

  @Patch(':id/status')
  async updateResultStatus(
    @Param('id') id: string,
    @Body() body: UpdateResultStatusDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultCardDto }> {
    const card = await this.resultsService.getResultCardById(id, branch.branchId);
    if (!card) throw new NotFoundException('Result card not found');
    await this.reportsService.ensureTeacherCanAccessClassSection(
      card.classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const data = await this.resultsService.updateResultCardStatus(
      id,
      body.status,
      branch.branchId,
      user.id,
    );
    return { data };
  }

  @Patch(':id/comment')
  async updateResultComment(
    @Param('id') id: string,
    @Body() body: UpdateResultCommentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultCardDto }> {
    const card = await this.resultsService.getResultCardById(id, branch.branchId);
    if (!card) throw new NotFoundException('Result card not found');
    await this.reportsService.ensureTeacherCanAccessClassSection(
      card.classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const data = await this.resultsService.updateResultCardComment(
      id,
      body.classTeacherComment,
      branch.branchId,
    );
    return { data };
  }

  @Get('student/:studentId/cards')
  async listResultCardsForStudent(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string | undefined,
    @Query('reportKind') reportKindParam: string | undefined,
    @Query('publishedOnly') publishedOnlyParam: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultCardDto[] }> {
    await this.reportsService.ensureUserCanAccessStudent(
      studentId,
      user.id,
      user.roles,
    );
    const roles = (user.roles || []).map((r) => r.toLowerCase());
    const isParent = roles.some((r) => ['parent', 'guardian'].includes(r));
    const publishedOnly =
      publishedOnlyParam === 'true' || publishedOnlyParam === '1' || isParent;
    const reportKindFilter = reportKindParam ? parseReportKindParam(reportKindParam) : undefined;
    const data = await this.resultsService.listResultCardsByStudent(
      studentId,
      branch.branchId,
      academicYearId,
      resultType,
      publishedOnly,
      reportKindFilter,
    );
    return { data };
  }

  @Get('class-section/:classSectionId/cards')
  async listResultCardsForClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string,
    @Query('reportKind') reportKindParam: string | undefined,
    @Query('progressSequence') progressSequenceParam: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ResultCardDto[] }> {
    await this.reportsService.ensureTeacherCanAccessClassSection(
      classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    if (!academicYearId) {
      throw new ForbiddenException('academicYearId is required');
    }
    const type = (resultType === 'interim' || resultType === 'mid_term' || resultType === 'final'
      ? resultType
      : 'final') as ResultType;
    const reportKind =
      reportKindParam === 'annual_report' || reportKindParam === 'progress_report'
        ? reportKindParam
        : 'term_report';
    const seqRaw = progressSequenceParam ? Number(progressSequenceParam) : undefined;
    const progressSequence =
      seqRaw != null && Number.isInteger(seqRaw) && seqRaw >= 1 && seqRaw <= 12 ? seqRaw : undefined;
    const data = await this.resultsService.listResultCardsByClassSection(
      classSectionId,
      branch.branchId,
      academicYearId,
      type,
      reportKind,
      progressSequence,
    );
    return { data };
  }

  @Get('class-section/:classSectionId/marks-readiness')
  async getMarksReadinessForClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { studentId: string; missingAssessmentTitles: string[] }[] }> {
    await this.reportsService.ensureTeacherCanAccessClassSection(
      classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const type = (resultType === 'interim' || resultType === 'mid_term' || resultType === 'final'
      ? resultType
      : 'final') as ResultType;
    const data = await this.resultsService.getMarksReadinessForClassSection(
      classSectionId,
      branch.branchId,
      academicYearId,
      type,
    );
    return { data };
  }

  @Get('cards/:resultCardId/deliveries')
  async listResultCardDeliveries(
    @Param('resultCardId') resultCardId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: Record<string, unknown>[] }> {
    const card = await this.resultsService.getResultCardById(resultCardId, branch.branchId);
    if (!card) throw new NotFoundException('Result card not found');
    await this.reportsService.ensureTeacherCanAccessClassSection(
      card.classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const data = await this.resultsService.listResultCardDeliveries(resultCardId, branch.branchId);
    return { data };
  }

  @Post('cards/:resultCardId/deliveries')
  async recordResultCardDelivery(
    @Param('resultCardId') resultCardId: string,
    @Body() body: RecordResultCardDeliveryDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: Record<string, unknown> }> {
    const card = await this.resultsService.getResultCardById(resultCardId, branch.branchId);
    if (!card) throw new NotFoundException('Result card not found');
    await this.reportsService.ensureTeacherCanAccessClassSection(
      card.classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const data = await this.resultsService.recordResultCardDelivery(
      resultCardId,
      branch.branchId,
      user.id,
      {
        deliveryMethod: body.deliveryMethod,
        recipientContact: body.recipientContact,
        deliveryStatus: body.deliveryStatus,
        metadata: body.metadata,
      },
    );
    return { data };
  }

  @Get('class-section/:classSectionId/bulk-pdf')
  async getBulkResultCardPdf(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string,
    @Query('pdfVariant') pdfVariantParam: string | undefined,
    @Res() res: Response,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.reportsService.ensureTeacherCanAccessClassSection(
      classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const type = (resultType === 'interim' || resultType === 'mid_term' || resultType === 'final'
      ? resultType
      : 'final') as ResultType;
    const pdfVariant =
      pdfVariantParam === 'minimal' || pdfVariantParam === 'modern' ? pdfVariantParam : undefined;
    const stream = await this.resultsService.getBulkResultCardPdfStream(
      classSectionId,
      branch.branchId,
      academicYearId,
      type,
      pdfVariant,
    );
    const label = type === 'interim' ? 'interim' : type === 'mid_term' ? 'mid-term' : 'final';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="results-${classSectionId}-${label}.zip"`,
    );
    stream.pipe(res);
  }

  @Get('class-section/:classSectionId')
  async getResultsForClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Query('resultType') resultType: string,
    @Query('progressMonth') progressMonthParam: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ClassSectionResultsDto }> {
    await this.reportsService.ensureTeacherCanAccessClassSection(
      classSectionId,
      user.id,
      user.roles,
      branch.branchId,
    );
    const type = (resultType === 'interim' || resultType === 'mid_term' || resultType === 'final'
      ? resultType
      : 'final') as ResultType;
    const monthRaw = progressMonthParam ? Number(progressMonthParam) : undefined;
    const progressMonth =
      monthRaw != null && Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
        ? monthRaw
        : undefined;
    const scope =
      progressMonth != null
        ? { progressMonth }
        : type === 'mid_term'
          ? { termWindow: 'until_mid' as const }
          : undefined;
    const data = await this.resultsService.getResultsForClassSection(
      classSectionId,
      branch.branchId,
      academicYearId,
      type,
      scope,
    );
    return { data };
  }
}
