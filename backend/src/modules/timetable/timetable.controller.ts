import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import {
  CurrentBranch,
  CurrentBranchContext,
} from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { TimetableService } from './timetable.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { GenerateTimetableDto } from './dto/generate-timetable.dto';
import { ReplicateDayDto } from './dto/replicate-day.dto';
import { ReplicateAcrossSectionsDto } from './dto/replicate-across-sections.dto';
import { ReplicateFromSectionDto } from './dto/replicate-from-section.dto';
import { StaffService } from '../staff/staff.service';
import { SupabaseConfig } from '../../common/config/supabase.config';

@Controller('api/v1/timetable')
@UseGuards(JwtAuthGuard, BranchGuard)
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly staffService: StaffService,
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  private async ensureFeatureEditAccess(
    user: CurrentUserPayload,
    branchId: string,
    featureCode: string,
  ): Promise<void> {
    const roleNames = user.roles || [];
    if (roleNames.includes('school_admin')) return;
    if (roleNames.length === 0) throw new ForbiddenException('No role assigned for this user');

    const supabase = this.supabaseConfig.getClient();
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id')
      .in('name', roleNames);
    if (rolesError) throw new ForbiddenException('Unable to verify role permissions');
    const roleIds = (rolesData || []).map((r: { id: string }) => r.id);
    if (roleIds.length === 0) throw new ForbiddenException('No valid role found for this user');

    const candidateFeatureCodes =
      featureCode === 'timetable_management'
        ? ['timetable_management', 'timetable']
        : [featureCode];

    const { data: featureRows, error: featureError } = await supabase
      .from('features')
      .select('id')
      .in('code', candidateFeatureCodes);
    if (featureError || !featureRows || featureRows.length === 0) {
      throw new ForbiddenException(`${featureCode} permission feature not configured`);
    }

    const featureIds = featureRows.map((f: { id: string }) => f.id);
    const { data: permissionRows, error: permissionError } = await supabase
      .from('role_permissions')
      .select('permission')
      .eq('branch_id', branchId)
      .in('feature_id', featureIds)
      .in('role_id', roleIds);
    if (permissionError) {
      throw new ForbiddenException(`Unable to verify ${featureCode} edit permissions`);
    }

    const canEdit = (permissionRows || []).some(
      (row: { permission: string }) => row.permission === 'edit',
    );
    if (!canEdit) throw new ForbiddenException(`You do not have edit access to ${featureCode}`);
  }

  // CRITICAL: Specific routes BEFORE parameterized routes
  @Get('teacher/me')
  async getMyTimetable(
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    // Get staff ID from user ID
    const staff = await this.staffService.getStaffByUserId(user.id, branch.branchId);
    if (!staff) {
      throw new Error('Staff member not found for current user');
    }

    const data = await this.timetableService.getTeacherTimetable(
      staff.id,
      branch.branchId,
      academicYearId,
    );
    return { data };
  }

  @Get('conflicts')
  async checkConflicts(
    @CurrentBranch() branch: { branchId: string },
    @Query('classSectionId') classSectionId?: string,
    @Query('staffId') staffId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const data = await this.timetableService.checkConflicts(
      branch.branchId,
      academicYearId,
      {
        classSectionId,
        staffId,
      },
    );
    return { data };
  }

  @Get('validate')
  async validateTimetable(
    @CurrentBranch() branch: { branchId: string },
    @Query('classSectionId') classSectionId?: string,
    @Query('staffId') staffId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    // Same as conflicts endpoint (alias for validation)
    const data = await this.timetableService.checkConflicts(
      branch.branchId,
      academicYearId,
      {
        classSectionId,
        staffId,
      },
    );
    return { data };
  }

  @Get('student/:studentId')
  async getStudentTimetable(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const data = await this.timetableService.getStudentTimetable(
      studentId,
      branch.branchId,
      academicYearId,
    );
    return { data };
  }

  @Get('class/:classSectionId')
  async getClassTimetable(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
    @Query('subjectTemplateId') subjectTemplateId?: string,
  ) {
    const data = await this.timetableService.getClassTimetable(
      classSectionId,
      branch.branchId,
      academicYearId,
      subjectTemplateId,
    );
    return { data };
  }

  @Get('class/:classSectionId/template-info')
  async getTimingTemplateInfo(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.timetableService.getTimingTemplateInfo(
      classSectionId,
      branch.branchId,
    );
    return { data };
  }

  @Get('teacher/:staffId')
  async getTeacherTimetable(
    @Param('staffId') staffId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const data = await this.timetableService.getTeacherTimetable(
      staffId,
      branch.branchId,
      academicYearId,
    );
    return { data };
  }

  @Post('slots')
  async createOrUpdateSlot(
    @Body() input: CreateTimetableSlotDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'timetable_management');
    const data = await this.timetableService.createOrUpdateSlot(
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Delete('slots/:id')
  async deleteSlot(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'timetable_management');
    const data = await this.timetableService.deleteSlot(
      id,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Post('generate')
  async generateTimetable(
    @Body() input: GenerateTimetableDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'timetable_management');
    const data = await this.timetableService.generateFromTimingTemplate(
      input.classSectionId,
      branch.branchId,
      user.email,
      branch.tenantId,
      input.academicYearId,
      input.subjectTemplateId,
    );
    return { data };
  }

  @Post('replicate-day')
  async replicateDay(
    @Body() input: ReplicateDayDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'timetable_management');
    const data = await this.timetableService.replicateDay(
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Post('replicate-across-sections')
  async replicateAcrossSections(
    @Body() input: ReplicateAcrossSectionsDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'timetable_management');
    const data = await this.timetableService.replicateAcrossSections(
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }

  @Post('replicate-from-section')
  async replicateFromSection(
    @Body() input: ReplicateFromSectionDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.ensureFeatureEditAccess(user, branch.branchId, 'timetable_management');
    const data = await this.timetableService.replicateFromSection(
      input,
      branch.branchId,
      user.email,
      branch.tenantId,
    );
    return { data };
  }
}

