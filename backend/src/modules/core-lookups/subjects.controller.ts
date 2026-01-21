import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CoreLookupsService } from './core-lookups.service';
import { QuerySubjectsDto } from './dto/query-subjects.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectDto } from './dto/subject.dto';

@Controller('api/v1/subjects')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SubjectsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QuerySubjectsDto,
  ): Promise<{
    data: SubjectDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listSubjects(query);
  }

  @Post()
  async create(@Body() body: CreateSubjectDto): Promise<{ data: SubjectDto }> {
    const created = await this.coreLookupsService.createSubject(body);
    return { data: created };
  }
}


