import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BranchesService } from './branches.service';
import { QueryBranchesDto } from './dto/query-branches.dto';
import { BranchDto } from './dto/branch.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AuthService } from '../auth/auth.service';

@Controller('api/v1/branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async list(
    @Query() query: QueryBranchesDto,
  ): Promise<{
    data: BranchDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.branchesService.list(query);
  }

  @Get('by-tenant')
  async listByTenant(@CurrentUser() user: { id: string }): Promise<{ data: BranchDto[] }> {
    // Get user's branches to determine tenant
    const userData = await this.authService.getCurrentUser(user.id);
    const branches = userData.branches ?? [];
    
    // Get tenant ID from first branch (all user's branches should be in same tenant)
    const tenantId = branches.length > 0 ? branches[0].tenantId : null;
    
    return this.branchesService.listByTenant(tenantId, user.id);
  }

  @Get(':id/storage')
  async getStorage(
    @Param('id') id: string,
  ): Promise<{ data: { quotaGb: number; usedBytes: number; usedPercentage: number } }> {
    const storage = await this.branchesService.getStorage(id);
    return { data: storage };
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
}




