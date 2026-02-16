import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { SubjectDto } from './dto/subject.dto';

@Controller('api/v1/subjects')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SubjectsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QuerySubjectsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: SubjectDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listSubjects(query, branch.branchId);
  }

  @Post()
  async create(
    @Body() body: CreateSubjectDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectDto }> {
    const created = await this.coreLookupsService.createSubject(body, branch.branchId, branch.tenantId);
    return { data: created };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSubjectDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SubjectDto }> {
    const updated = await this.coreLookupsService.updateSubject(id, body, branch.branchId);
    return { data: updated };
  }
}


