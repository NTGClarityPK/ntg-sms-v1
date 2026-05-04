import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QueryLevelsDto } from './dto/query-levels.dto';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { LevelDto } from './dto/level.dto';
import { DeletionStatusDto, EntityDeletedDto } from './dto/deletion-status.dto';

@ApiTags('Academic structure')
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
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: LevelDto }> {
    const created = await this.coreLookupsService.createLevel(body, branch.branchId, branch.tenantId, user.email);
    return { data: created };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateLevelDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: LevelDto }> {
    const updated = await this.coreLookupsService.updateLevel(id, body, branch.branchId, user.email);
    return { data: updated };
  }

  @Get(':id/deletion-check')
  async deletionCheck(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: DeletionStatusDto }> {
    return this.coreLookupsService.getLevelDeletionStatus(id, branch.branchId, user.id, user.email);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: EntityDeletedDto }> {
    return this.coreLookupsService.deleteLevel(id, branch.branchId, user.id, user.email);
  }
}


