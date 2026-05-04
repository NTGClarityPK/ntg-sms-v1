import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SubjectTemplatesService } from './subject-templates.service';
import { CreateSubjectTemplateDto } from './dto/create-subject-template.dto';
import { UpdateSubjectTemplateDto } from './dto/update-subject-template.dto';
import { SubjectTemplateDto } from './dto/subject-template.dto';
import { QuerySubjectTemplatesDto } from './dto/query-subject-templates.dto';
import { AssignClassesToTemplateDto } from './dto/assign-classes.dto';
import { AssignLevelsToTemplateDto } from './dto/assign-levels.dto';
import { AssignStudentToTemplateDto } from './dto/assign-student.dto';

@ApiTags('Subject templates')
@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/subject-templates')
export class SubjectTemplatesController {
  constructor(private readonly subjectTemplatesService: SubjectTemplatesService) {}

  @Post()
  async create(
    @Body() body: CreateSubjectTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: SubjectTemplateDto }> {
    const created = await this.subjectTemplatesService.createSubjectTemplate(
      body,
      branch.branchId,
      branch.tenantId,
      user.email,
    );
    return { data: created };
  }

  @Get()
  async list(
    @Query() query: QuerySubjectTemplatesDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectTemplateDto[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.subjectTemplatesService.listSubjectTemplates(query, branch.branchId);
  }

  @Get('classes-with-templates')
  async getClassIdsWithTemplates(
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: string[] }> {
    return this.subjectTemplatesService.getClassIdsWithTemplates(branch.branchId);
  }

  @Get('class/:classId')
  async getTemplatesForClass(
    @Param('classId') classId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectTemplateDto[] }> {
    return this.subjectTemplatesService.getTemplatesForClass(classId, branch.branchId);
  }

  @Get('level/:levelId')
  async getTemplatesForLevel(
    @Param('levelId') levelId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectTemplateDto[] }> {
    return this.subjectTemplatesService.getTemplatesForLevel(levelId, branch.branchId);
  }

  @Post('students/:studentId/assign')
  async assignStudent(
    @Param('studentId') studentId: string,
    @Body() body: AssignStudentToTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: SubjectTemplateDto }> {
    return this.subjectTemplatesService.assignStudentToTemplate(
      studentId,
      body.subjectTemplateId,
      body.academicYearId,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
  }

  @Get('students/:studentId')
  async getStudentTemplate(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectTemplateDto | null }> {
    // TODO: Get active academic year if not provided
    if (!academicYearId) {
      throw new Error('academicYearId is required');
    }
    return this.subjectTemplatesService.getStudentTemplate(studentId, academicYearId, branch.branchId);
  }

  @Delete('students/:studentId')
  async removeStudentTemplate(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { studentId: string; academicYearId: string } }> {
    // TODO: Get active academic year if not provided
    if (!academicYearId) {
      throw new Error('academicYearId is required');
    }
    return this.subjectTemplatesService.removeStudentTemplate(
      studentId,
      academicYearId,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectTemplateDto }> {
    const template = await this.subjectTemplatesService.getSubjectTemplateById(id, branch.branchId);
    return { data: template };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSubjectTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: SubjectTemplateDto }> {
    const updated = await this.subjectTemplatesService.updateSubjectTemplate(
      id,
      body,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data: updated };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { id: string } }> {
    return this.subjectTemplatesService.deleteSubjectTemplate(
      id,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
  }

  @Post(':id/assign-classes')
  async assignClasses(
    @Param('id') id: string,
    @Body() body: AssignClassesToTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: string[] }> {
    return this.subjectTemplatesService.assignClassesToTemplate(
      id,
      body.classIds,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
  }

  @Post(':id/assign-levels')
  async assignLevels(
    @Param('id') id: string,
    @Body() body: AssignLevelsToTemplateDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: string[] }> {
    return this.subjectTemplatesService.assignLevelsToTemplate(
      id,
      body.levelIds,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
  }
}





