import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QueryClassesDto } from './dto/query-classes.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassDto } from './dto/class.dto';
import { DeletionStatusDto, EntityDeletedDto } from './dto/deletion-status.dto';

@Controller('api/v1/classes')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ClassesController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

  @Get(':id/deletion-check')
  async deletionCheck(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: DeletionStatusDto }> {
    return this.coreLookupsService.getClassDeletionStatus(id, branch.branchId, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: EntityDeletedDto }> {
    return this.coreLookupsService.deleteClass(id, branch.branchId, user.id, user.email);
  }

  @Get()
  async list(
    @Query() query: QueryClassesDto,
    @CurrentBranch() branch: CurrentBranchContext,
  ): Promise<{
    data: ClassDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.coreLookupsService.listClasses(query, branch.branchId);
  }

  @Post()
  async create(
    @Body() body: CreateClassDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ClassDto }> {
    const created = await this.coreLookupsService.createClass(body, branch.branchId, branch.tenantId, user.email);
    return { data: created };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateClassDto,
    @CurrentBranch() branch: CurrentBranchContext,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ClassDto }> {
    const updated = await this.coreLookupsService.updateClass(id, body, branch.branchId, user.email);
    return { data: updated };
  }
}


