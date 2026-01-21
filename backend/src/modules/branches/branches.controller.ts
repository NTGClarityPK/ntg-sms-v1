import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchesService } from './branches.service';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { BranchDto } from './dto/branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('api/v1/branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async list(
    @Query() query: QueryBranchesDto,
  ): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.branchesService.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<{ data: BranchDto }> {
    const branch = await this.branchesService.getById(id);
    return { data: branch };
  }

  @Post()
  async create(@Body() body: CreateBranchDto): Promise<{ data: BranchDto }> {
    const created = await this.branchesService.create(body);
    return { data: created };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBranchDto,
  ): Promise<{ data: BranchDto }> {
    const updated = await this.branchesService.update(id, body);
    return { data: updated };
  }

  @Get(':id/storage')
  async getStorage(
    @Param('id') id: string,
  ): Promise<{ data: { quotaGb: number; usedBytes: number; usedPercentage: number } }> {
    const storage = await this.branchesService.getStorage(id);
    return { data: storage };
  }
}


