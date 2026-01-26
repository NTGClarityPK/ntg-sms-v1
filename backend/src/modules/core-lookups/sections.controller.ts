import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { SectionDto } from './dto/section.dto';

@Controller('api/v1/sections')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SectionsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QuerySectionsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: SectionDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listSections(query, branch.branchId);
  }

  @Post()
  async create(
    @Body() body: CreateSectionDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: SectionDto }> {
    const created = await this.coreLookupsService.createSection(body, branch.branchId, branch.tenantId);
    return { data: created };
  }
}


