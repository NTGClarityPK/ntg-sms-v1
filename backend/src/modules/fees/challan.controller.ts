import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { GenerateFeeChallansDto } from './dto/generate-challans.dto';
import { ChallanService } from './challan.service';
import { FeatureAccessGuard, RequiresFeature } from '../subscription/guards/feature-access.guard';

@ApiTags('Fees')
@Controller('api/v1/fees/challans')
@UseGuards(JwtAuthGuard, BranchGuard, FeatureAccessGuard)
@RequiresFeature('hasFeeManagement')
export class ChallanController {
  constructor(private readonly challanService: ChallanService) {}

  private ensureFeesAdmin(user: CurrentUserPayload): void {
    const roles = user.roles ?? [];
    if (roles.includes('school_admin') || roles.includes('super_admin') || roles.includes('principal')) return;
    throw new ForbiddenException('Only school admin can manage challans');
  }

  @Post('generate')
  async generate(
    @Body() dto: GenerateFeeChallansDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: Array<{ studentId: string; challanId: string; challanNumber: string; pdfUrl: string | null }> }> {
    this.ensureFeesAdmin(user);
    return this.challanService.generate(
      {
        studentIds: dto.studentIds,
        months: dto.months,
        dueDate: dto.dueDate,
        autoCalculateDueDate: dto.autoCalculateDueDate,
        studentOverrides: dto.studentOverrides,
        selectedInheritedTemplateId: dto.selectedInheritedTemplateId,
      },
      branch.branchId,
    );
  }

  @Post('generate-jobs')
  async enqueueGenerateJob(
    @Body() dto: GenerateFeeChallansDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: { jobId: string } }> {
    this.ensureFeesAdmin(user);
    return this.challanService.enqueueGenerateJob(
      {
        studentIds: dto.studentIds,
        months: dto.months,
        dueDate: dto.dueDate,
        autoCalculateDueDate: dto.autoCalculateDueDate,
        studentOverrides: dto.studentOverrides,
        selectedInheritedTemplateId: dto.selectedInheritedTemplateId,
      },
      branch.branchId,
      user.id,
    );
  }

  @Get('generate-jobs/:jobId')
  async getGenerateJob(
    @Param('jobId') jobId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: {
      id: string;
      status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
      totalStudents: number;
      processedStudents: number;
      errorMessage: string | null;
      result: unknown | null;
      createdAt: string;
      updatedAt: string;
    };
  }> {
    this.ensureFeesAdmin(user);
    return this.challanService.getGenerateJob(jobId, branch.branchId);
  }

  @Get('roster')
  async getRoster(
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string,
    @Query('month') month: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.ensureFeesAdmin(user);
    return this.challanService.getClassSectionRoster({ classId, sectionId, month }, branch.branchId);
  }

  @Get('inherited-template-candidates')
  async getInheritedTemplateCandidates(
    @Query('classId') classId: string,
    @Query('sectionId') sectionId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: {
      level: Array<{
        templateId: string;
        name: string;
        type: 'Fee' | 'Discount';
        scope: string;
        assignedScopeId: string;
        metrics: Array<{
          id: string;
          name: string;
          amountType: 'Absolute' | 'Percentage';
          amount: number;
          perDay: boolean;
          displayOrder: number;
        }>;
      }>;
      class: Array<{
        templateId: string;
        name: string;
        type: 'Fee' | 'Discount';
        scope: string;
        assignedScopeId: string;
        metrics: Array<{
          id: string;
          name: string;
          amountType: 'Absolute' | 'Percentage';
          amount: number;
          perDay: boolean;
          displayOrder: number;
        }>;
      }>;
      classSection: Array<{
        templateId: string;
        name: string;
        type: 'Fee' | 'Discount';
        scope: string;
        assignedScopeId: string;
        metrics: Array<{
          id: string;
          name: string;
          amountType: 'Absolute' | 'Percentage';
          amount: number;
          perDay: boolean;
          displayOrder: number;
        }>;
      }>;
    };
  }> {
    this.ensureFeesAdmin(user);
    return this.challanService.getInheritedTemplateCandidates({ classId, sectionId }, branch.branchId);
  }

  @Get('my-students')
  async listMyStudents(
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.challanService.listMyStudentsPending(user.id, branch.branchId);
  }

  @Get('student/:studentId')
  async listByStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.challanService.listByStudent(studentId, branch.branchId);
  }

  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ) {
    return this.challanService.getById(id, branch.branchId);
  }
}

