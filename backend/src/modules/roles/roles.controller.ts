import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { UpdatePermissionsDto } from './dto/permission-matrix.dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, BranchGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  async listRoles() {
    const data = await this.rolesService.listRoles();
    return { data };
  }

  @Get('features')
  async listFeatures() {
    const data = await this.rolesService.listFeatures();
    return { data };
  }

  @Get('permissions')
  async getPermissions(@CurrentBranch() branch: { branchId: string }) {
    const data = await this.rolesService.getPermissionMatrix(branch.branchId);
    return { data };
  }

  @Put('permissions')
  async updatePermissions(
    @CurrentBranch() branch: { branchId: string },
    @Body() input: UpdatePermissionsDto,
  ) {
    const data = await this.rolesService.updatePermissions(branch.branchId, input);
    return { data };
  }
}

