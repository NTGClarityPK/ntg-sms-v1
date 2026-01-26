import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { BranchGuard } from '../../common/guards/branch.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentBranch, CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { CoreLookupsService } from './core-lookups.service';
import { QueryClassesDto } from './dto/query-classes.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassDto } from './dto/class.dto';

@Controller('api/v1/classes')
@UseGuards(JwtAuthGuard, BranchGuard)
export class ClassesController {
  constructor(private readonly coreLookupsService: CoreLookupsService) {}

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
  ): Promise<{ data: ClassDto }> {
    const created = await this.coreLookupsService.createClass(body, branch.branchId, branch.tenantId);
    return { data: created };
  }
}


