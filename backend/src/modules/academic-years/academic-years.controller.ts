import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { QueryAcademicYearsDto } from './dto/query-academic-years.dto';
import { AcademicYearDto } from './dto/academic-year.dto';

@Controller('api/v1/academic-years')
@UseGuards(JwtAuthGuard, BranchGuard)
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Get()
  async list(
    @Query() query: QueryAcademicYearsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: AcademicYearDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.academicYearsService.list(query, branch.tenantId);
  }

  @Get('active')
  async getActive(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: AcademicYearDto | null }> {
    const year = await this.academicYearsService.getActive(branch.tenantId);
    return { data: year };
  }

  @Post()
  async create(
    @Body() body: CreateAcademicYearDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AcademicYearDto }> {
    const created = await this.academicYearsService.create(body, branch.tenantId);
    return { data: created };
  }

  @Patch(':id/activate')
  async activate(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AcademicYearDto }> {
    const updated = await this.academicYearsService.activate(id, branch.tenantId);
    return { data: updated };
  }

  @Patch(':id/lock')
  async lock(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: AcademicYearDto }> {
    const updated = await this.academicYearsService.lock(id, branch.tenantId);
    return { data: updated };
  }
}


