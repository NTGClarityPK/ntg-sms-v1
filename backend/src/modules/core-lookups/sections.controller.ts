import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QuerySectionsDto } from './dto/query-sections.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionDto } from './dto/section.dto';
import { DeletionStatusDto, EntityDeletedDto } from './dto/deletion-status.dto';

@Controller('api/v1/sections')
@UseGuards(JwtAuthGuard, BranchGuard)
export class SectionsController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get(':id/deletion-check')
  async deletionCheck(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: DeletionStatusDto }> {
    return this.coreLookupsService.getSectionDeletionStatus(id, branch.branchId, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: EntityDeletedDto }> {
    return this.coreLookupsService.deleteSection(id, branch.branchId, user.id, user.email);
  }

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
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: SectionDto }> {
    const created = await this.coreLookupsService.createSection(body, branch.branchId, branch.tenantId, user.email);
    return { data: created };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSectionDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: SectionDto }> {
    const updated = await this.coreLookupsService.updateSection(id, body, branch.branchId, user.email);
    return { data: updated };
  }
}


