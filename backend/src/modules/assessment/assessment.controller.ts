import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { AssessmentService } from './assessment.service';
import { QueryAssessmentTypesDto } from './dto/query-assessment-types.dto';
import { AssessmentTypeDto } from './dto/assessment-type.dto';
import { CreateAssessmentTypeDto } from './dto/create-assessment-type.dto';
import { GradeTemplateDto } from './dto/grade-template.dto';
import { CreateGradeTemplateDto } from './dto/create-grade-template.dto';
import { AssignGradeTemplateDto } from './dto/assign-grade-template.dto';
import { ClassGradeAssignmentDto } from './dto/class-grade-assignment.dto';

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('assessment-types')
  async listAssessmentTypes(
    @Query() query: QueryAssessmentTypesDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentTypeDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.assessmentService.listAssessmentTypes(query, branch.branchId);
  }

  @Post('assessment-types')
  async createAssessmentType(
    @Body() body: CreateAssessmentTypeDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AssessmentTypeDto }> {
    const created = await this.assessmentService.createAssessmentType(body, branch.branchId, branch.tenantId);
    return { data: created };
  }

  @Get('grade-templates')
  async listGradeTemplates(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: GradeTemplateDto[] }> {
    return this.assessmentService.listGradeTemplates(branch.branchId);
  }

  @Post('grade-templates')
  async createGradeTemplate(
    @Body() body: CreateGradeTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: GradeTemplateDto }> {
    const ranges = body.ranges.map((r, idx) => ({
      letter: r.letter,
      minPercentage: r.minPercentage,
      maxPercentage: r.maxPercentage,
      sortOrder: r.sortOrder ?? idx,
    }));
    const created = await this.assessmentService.createGradeTemplate(
      { name: body.name, ranges },
      branch.branchId,
      branch.tenantId,
    );
    return { data: created };
  }

  @Put('grade-templates/:id')
  async updateGradeTemplate(
    @Param('id') id: string,
    @Body() body: Partial<CreateGradeTemplateDto>,
  ): Promise<{ data: GradeTemplateDto }> {
    const ranges = body.ranges
      ? body.ranges.map((r, idx) => ({
          letter: r.letter,
          minPercentage: r.minPercentage,
          maxPercentage: r.maxPercentage,
          sortOrder: r.sortOrder ?? idx,
        }))
      : undefined;
    const updated = await this.assessmentService.updateGradeTemplate(id, { name: body.name, ranges });
    return { data: updated };
  }

  @Delete('grade-templates/:id')
  async deleteGradeTemplate(@Param('id') id: string): Promise<{ data: { id: string } }> {
    const result = await this.assessmentService.deleteGradeTemplate(id);
    return { data: result };
  }

  @Put('grade-templates/:id/assign-classes')
  async assignGradeTemplateToClass(
    @Param('id') gradeTemplateId: string,
    @Body() body: Omit<AssignGradeTemplateDto, 'gradeTemplateId'>,
  ): Promise<{ data: unknown }> {
    const result = await this.assessmentService.assignGradeTemplateToClass({
      classId: body.classId,
      gradeTemplateId,
      minimumPassingGrade: body.minimumPassingGrade,
    });
    return { data: result.data };
  }

  @Get('grade-templates/assignments')
  async listClassGradeAssignments(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: ClassGradeAssignmentDto[] }> {
    const result = await this.assessmentService.listClassGradeAssignments(branch.branchId);
    return {
      data: result.data.map(
        (row) =>
          new ClassGradeAssignmentDto({
            id: row.id,
            classId: row.classId,
            className: row.className,
            gradeTemplateId: row.gradeTemplateId,
            gradeTemplateName: row.gradeTemplateName,
            minimumPassingGrade: row.minimumPassingGrade,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }),
      ),
    };
  }

  @Get('settings/leave-quota')
  async getLeaveQuota(@Query('academicYearId') academicYearId: string): Promise<{ data: { academicYearId: string; annualQuota: number } }> {
    return this.assessmentService.getLeaveQuota(academicYearId);
  }

  @Put('settings/leave-quota')
  async setLeaveQuota(
    @Body() body: { academicYearId: string; annualQuota: number },
  ): Promise<{ data: { academicYearId: string; annualQuota: number } }> {
    return this.assessmentService.setLeaveQuota(body.academicYearId, body.annualQuota);
  }
}


