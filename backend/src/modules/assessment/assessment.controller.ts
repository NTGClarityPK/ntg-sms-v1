import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AssessmentService } from './assessment.service';
import { QueryAssessmentTypesDto } from './dto/query-assessment-types.dto';
import { AssessmentTypeDto } from './dto/assessment-type.dto';
import { CreateAssessmentTypeDto } from './dto/create-assessment-type.dto';
import { GradeTemplateDto } from './dto/grade-template.dto';
import { CreateGradeTemplateDto } from './dto/create-grade-template.dto';
import { AssignGradeTemplateDto } from './dto/assign-grade-template.dto';
import { ClassGradeAssignmentDto } from './dto/class-grade-assignment.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('assessment-types')
  async listAssessmentTypes(
    @Query() query: QueryAssessmentTypesDto,
  ): Promise<{ data: AssessmentTypeDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.assessmentService.listAssessmentTypes(query);
  }

  @Post('assessment-types')
  async createAssessmentType(@Body() body: CreateAssessmentTypeDto): Promise<{ data: AssessmentTypeDto }> {
    const created = await this.assessmentService.createAssessmentType(body);
    return { data: created };
  }

  @Get('grade-templates')
  async listGradeTemplates(): Promise<{ data: GradeTemplateDto[] }> {
    return this.assessmentService.listGradeTemplates();
  }

  @Post('grade-templates')
  async createGradeTemplate(@Body() body: CreateGradeTemplateDto): Promise<{ data: GradeTemplateDto }> {
    const ranges = body.ranges.map((r, idx) => ({
      letter: r.letter,
      minPercentage: r.minPercentage,
      maxPercentage: r.maxPercentage,
      sortOrder: r.sortOrder ?? idx,
    }));
    const created = await this.assessmentService.createGradeTemplate({ name: body.name, ranges });
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
  async listClassGradeAssignments(): Promise<{ data: ClassGradeAssignmentDto[] }> {
    const result = await this.assessmentService.listClassGradeAssignments();
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


