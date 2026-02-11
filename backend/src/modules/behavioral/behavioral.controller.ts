import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AcademicYearsService } from '../academic-years/academic-years.service';
import { BehavioralService } from './behavioral.service';
import { CreateBehavioralAssessmentDto } from './dto/create-behavioral-assessment.dto';
import { UpdateBehavioralAssessmentDto } from './dto/update-behavioral-assessment.dto';
import { BehavioralAssessmentDto } from './dto/behavioral-assessment.dto';
import { PendingStudentDto } from './dto/pending-student.dto';
import { BehavioralMatrixResponseDto } from './dto/matrix-response.dto';

@Controller('api/v1/behavioral')
@UseGuards(JwtAuthGuard, BranchGuard)
export class BehavioralController {
  constructor(
    private readonly behavioralService: BehavioralService,
    private readonly academicYearsService: AcademicYearsService,
  ) {}

  /** Get students pending assessment this month for the current teacher. */
  @Get('pending')
  async getPending(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: PendingStudentDto[] }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(
      branch.branchId,
    );
    if (!activeYear) {
      return { data: [] };
    }
    return this.behavioralService.getPending(
      branch.branchId,
      activeYear.id,
      user.id,
    );
  }

  /** Get behavioral history for a student. */
  @Get('student/:studentId')
  async getByStudent(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<{ data: BehavioralAssessmentDto[] }> {
    return this.behavioralService.getByStudent(
      studentId,
      branch.branchId,
      academicYearId,
    );
  }

  /** Get matrix view for a class section (students × attributes). */
  @Get('matrix/:classSectionId')
  async getMatrix(
    @Param('classSectionId') classSectionId: string,
    @Query('month') month: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: BehavioralMatrixResponseDto }> {
    const activeYear = await this.academicYearsService.getActiveForBranch(
      branch.branchId,
    );
    if (!activeYear) {
      throw new BadRequestException('No active academic year found');
    }
    const assessmentMonth =
      month && /^\d{4}-\d{2}/.test(month)
        ? month.length === 7
          ? `${month}-01`
          : month.slice(0, 10)
        : new Date().toISOString().slice(0, 7) + '-01';
    return this.behavioralService.getMatrix(
      classSectionId,
      assessmentMonth,
      branch.branchId,
      activeYear.id,
    );
  }

  /** Create a behavioral assessment. */
  @Post()
  async create(
    @Body() dto: CreateBehavioralAssessmentDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: BehavioralAssessmentDto }> {
    return this.behavioralService.create(dto, user.id, branch.branchId);
  }

  /** Update an existing behavioral assessment. */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBehavioralAssessmentDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: BehavioralAssessmentDto }> {
    return this.behavioralService.update(id, dto, user.id, branch.branchId);
  }
}
