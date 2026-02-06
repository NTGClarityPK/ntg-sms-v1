import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import {
  CurrentBranch,
  type CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { AssessmentsService } from './assessments.service';
import { AssessmentDto } from './dto/assessment.dto';
import { QueryAssessmentsDto } from './dto/query-assessments.dto';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { AssessmentStatisticsDto } from './dto/assessment-statistics.dto';
import { ClassStatisticsDto } from './dto/class-statistics.dto';
import { SubjectStatisticsDto } from './dto/subject-statistics.dto';
import { StudentPerformanceDto } from './dto/student-performance.dto';

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/assessments')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  async listAssessments(
    @Query() query: QueryAssessmentsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: AssessmentDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.assessmentsService.listAssessments(
      query,
      branch.branchId,
      undefined,
      user.id,
    );
  }

  @Post()
  async createAssessment(
    @Body() body: CreateAssessmentDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: AssessmentDto }> {
    const created = await this.assessmentsService.createAssessment(
      body,
      branch.branchId,
      branch.tenantId,
      user.id,
    );
    return { data: created };
  }

  @Put(':id')
  async updateAssessment(
    @Param('id') id: string,
    @Body() body: UpdateAssessmentDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentDto }> {
    const updated = await this.assessmentsService.updateAssessment(
      id,
      body,
      branch.branchId,
    );
    return { data: updated };
  }

  @Delete(':id')
  async deleteAssessment(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: { id: string } }> {
    const result = await this.assessmentsService.deleteAssessment(
      id,
      branch.branchId,
    );
    return { data: result };
  }

  @Post(':id/publish')
  async publishAssessment(
    @Param('id') id: string,
    @Body() body: { publishDate?: string },
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentDto }> {
    const result = await this.assessmentsService.publishAssessment(
      id,
      branch.branchId,
      body.publishDate,
    );
    return { data: result };
  }

  /**
   * Get statistics for a specific assessment
   */
  @Get(':id/statistics')
  async getAssessmentStatistics(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentStatisticsDto }> {
    const stats = await this.assessmentsService.getAssessmentStatistics(id, branch.branchId);
    return { data: stats };
  }

  /**
   * Get statistics for a class section
   */
  @Get('class/:classSectionId/statistics')
  async getClassStatistics(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: ClassStatisticsDto }> {
    const stats = await this.assessmentsService.getClassStatistics(classSectionId, branch.branchId);
    return { data: stats };
  }

  /**
   * Get statistics for a subject
   */
  @Get('subject/:subjectId/statistics')
  async getSubjectStatistics(
    @Param('subjectId') subjectId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectStatisticsDto }> {
    const stats = await this.assessmentsService.getSubjectStatistics(subjectId, branch.branchId);
    return { data: stats };
  }

  /**
   * Get performance summary for a specific student
   */
  @Get('student/:studentId/performance')
  async getStudentPerformance(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: StudentPerformanceDto }> {
    const performance = await this.assessmentsService.getStudentPerformance(studentId, branch.branchId);
    return { data: performance };
  }

  /**
   * Get a single assessment by ID
   * NOTE: This must come AFTER all other GET routes with specific paths
   * to avoid route conflicts in NestJS
   */
  @Get(':id')
  async getAssessmentById(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentDto }> {
    const assessment = await this.assessmentsService.getAssessmentById(id, branch.branchId);
    return { data: assessment };
  }
}


