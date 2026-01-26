import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { QueryTeacherAssignmentsDto } from './dto/query-teacher-assignments.dto';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';

@Controller('api/v1/teacher-assignments')
@UseGuards(JwtAuthGuard, BranchGuard)
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
  ) {}

  @Get()
  async list(
    @Query() query: QueryTeacherAssignmentsDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.teacherAssignmentsService.listTeacherAssignments(
      query,
      branch.branchId,
    );
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.teacherAssignmentsService.getTeacherAssignmentById(
      id,
      branch.branchId,
    );
    return { data };
  }

  @Post()
  async create(
    @Body() input: CreateTeacherAssignmentDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.teacherAssignmentsService.createTeacherAssignment(
      input,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateTeacherAssignmentDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.teacherAssignmentsService.updateTeacherAssignment(
      id,
      input,
      branch.branchId,
    );
    return { data };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.teacherAssignmentsService.deleteTeacherAssignment(id, branch.branchId);
    return { message: 'Teacher assignment deleted successfully' };
  }

  @Get('by-teacher/:staffId')
  async getByTeacher(
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.teacherAssignmentsService.getAssignmentsByTeacher(
      staffId,
      branch.branchId,
      academicYearId,
    );
  }

  @Get('by-class/:classSectionId')
  async getByClassSection(
    @Param('classSectionId') classSectionId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.teacherAssignmentsService.getAssignmentsByClassSection(
      classSectionId,
      branch.branchId,
      academicYearId,
    );
  }
}

