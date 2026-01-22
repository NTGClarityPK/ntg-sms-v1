import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { QueryStudentsDto } from './dto/query-students.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { GenerateStudentIdDto } from './dto/generate-student-id.dto';

@Controller('api/v1/students')
@UseGuards(JwtAuthGuard, BranchGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  async listStudents(
    @Query() query: QueryStudentsDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.studentsService.listStudents(query, branch.branchId);
  }

  @Get('generate-id')
  async generateStudentId(
    @Query() query: GenerateStudentIdDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.generateStudentId(query, branch.branchId);
    return { data };
  }

  @Get(':id')
  async getStudentById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.getStudentById(id, branch.branchId);
    return { data };
  }

  @Post()
  async createStudent(
    @Body() input: CreateStudentDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.createStudent(input, branch.branchId);
    return { data };
  }

  @Post('bulk-import')
  async bulkImport(
    @Body() input: { students: CreateStudentDto[] },
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.bulkImport(input.students, branch.branchId);
    return { data };
  }

  @Put(':id')
  async updateStudent(
    @Param('id') id: string,
    @Body() input: UpdateStudentDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.studentsService.updateStudent(id, input, branch.branchId);
    return { data };
  }
}

