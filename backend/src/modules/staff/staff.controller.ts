import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { QueryStaffDto } from './dto/query-staff.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { DeactivateStaffDto } from './dto/deactivate-staff.dto';

@Controller('api/v1/staff')
@UseGuards(JwtAuthGuard, BranchGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  async listStaff(
    @Query() query: QueryStaffDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.staffService.listStaff(query, branch.branchId);
  }

  @Get(':id')
  async getStaffById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.getStaffById(id, branch.branchId);
    return { data };
  }

  @Get(':id/assignments')
  async getAssignments(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.getAssignments(id, branch.branchId);
    return { data };
  }

  @Post()
  async createStaff(
    @Body() input: CreateStaffDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.createStaff(input, branch.branchId);
    return { data };
  }

  @Put(':id')
  async updateStaff(
    @Param('id') id: string,
    @Body() input: UpdateStaffDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.updateStaff(id, input, branch.branchId);
    return { data };
  }

  @Post(':id/deactivate')
  async deactivateStaff(
    @Param('id') id: string,
    @Body() input: DeactivateStaffDto,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.staffService.deactivateStaff(id, input, branch.branchId);
    return { data };
  }
}

