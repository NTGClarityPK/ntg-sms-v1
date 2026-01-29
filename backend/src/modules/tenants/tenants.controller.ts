import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch, type CurrentBranchContext } from '../../common/decorators/current-branch.decorator';
import { TenantsService } from './tenants.service';
import { TenantDto } from './dto/tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@UseGuards(JwtAuthGuard, BranchGuard)
@Controller('api/v1/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  async getMe(@CurrentBranch() branch: CurrentBranchContext): Promise<{ data: TenantDto }> {
    return this.tenantsService.getMe(branch.tenantId);
  }

  @Patch('me')
  async updateMe(
    @CurrentBranch() branch: CurrentBranchContext,
    @Body() body: UpdateTenantDto,
  ): Promise<{ data: TenantDto }> {
    const updated = await this.tenantsService.updateMe(branch.tenantId, { name: body.name });
    return { data: updated.data };
  }
}


