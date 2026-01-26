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
import { ClassSectionsService } from './class-sections.service';
import { QueryClassSectionsDto } from './dto/query-class-sections.dto';
import { CreateClassSectionDto } from './dto/create-class-section.dto';
import { BulkCreateClassSectionDto } from './dto/bulk-create-class-section.dto';
import { UpdateClassSectionDto } from './dto/update-class-section.dto';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';

@Controller('api/v1/class-sections')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ClassSectionsController {
  constructor(private readonly classSectionsService: ClassSectionsService) {}

  @Get()
  async list(
    @Query() query: QueryClassSectionsDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.classSectionsService.listClassSections(query, branch.branchId);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.classSectionsService.getClassSectionById(id, branch.branchId);
    return { data };
  }

  @Post()
  async create(
    @Body() input: CreateClassSectionDto | BulkCreateClassSectionDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    // Check if it's bulk create
    if ('classSections' in input) {
      return this.classSectionsService.bulkCreateClassSections(
        input as BulkCreateClassSectionDto,
        branch.branchId,
      );
    }
    const data = await this.classSectionsService.createClassSection(
      input as CreateClassSectionDto,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateClassSectionDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.classSectionsService.updateClassSection(id, input, branch.branchId);
    return { data };
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    await this.classSectionsService.deleteClassSection(id, branch.branchId);
    return { message: 'Class section deleted successfully' };
  }

  @Get(':id/students')
  async getStudents(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.classSectionsService.getStudentsInClassSection(id, branch.branchId);
  }

  @Put(':id/class-teacher')
  async assignClassTeacher(
    @Param('id') id: string,
    @Body() input: AssignClassTeacherDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.classSectionsService.assignClassTeacher(
      id,
      input.staffId ?? null,
      branch.branchId,
    );
    return { data };
  }
}

