import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { TimetableService } from './timetable.service';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { GenerateTimetableDto } from './dto/generate-timetable.dto';
import { StaffService } from '../staff/staff.service';

@Controller('api/v1/timetable')
@UseGuards(JwtAuthGuard, BranchGuard)
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly staffService: StaffService,
  ) {}

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

  @Get('class/:classSectionId')
  async getClassTimetable(
    @Param('classSectionId') classSectionId: string,
    @CurrentBranch() branch: { branchId: string },
    @Query('academicYearId') academicYearId?: string,
  ) {
    const data = await this.timetableService.getClassTimetable(
      classSectionId,
      branch.branchId,
      academicYearId,
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
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.timetableService.createOrUpdateSlot(input, branch.branchId);
    return { data };
  }

  @Delete('slots/:id')
  async deleteSlot(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.timetableService.deleteSlot(id, branch.branchId);
    return { data };
  }

  @Post('generate')
  async generateTimetable(
    @Body() input: GenerateTimetableDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.timetableService.generateFromTimingTemplate(
      input.classSectionId,
      branch.branchId,
      input.academicYearId,
    );
    return { data };
  }
}

