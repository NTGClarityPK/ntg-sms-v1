import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QueryLevelsDto } from './dto/query-levels.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { LevelDto } from './dto/level.dto';

@Controller('api/v1/levels')
@UseGuards(JwtAuthGuard, BranchGuard)
export class LevelsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get()
  async list(
    @Query() query: QueryLevelsDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: LevelDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listLevels(query, branch.branchId);
  }

  @Post()
  async create(
    @Body() body: CreateLevelDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{ data: LevelDto }> {
    const created = await this.coreLookupsService.createLevel(body, branch.branchId, branch.tenantId);
    return { data: created };
  }
}


