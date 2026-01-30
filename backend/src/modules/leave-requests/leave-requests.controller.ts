import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BranchGuard } from '../../common/guards/branch.guard';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';

@Controller('api/v1/leave-requests')
@UseGuards(JwtAuthGuard, BranchGuard)
export class LeaveRequestsController {
  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
  ) {}

  @Get()
  async listLeaveRequests(
    @Query() query: QueryLeaveRequestsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const isParent = user.roles?.includes('parent');
    return this.leaveRequestsService.listLeaveRequests(
      query,
      user.id,
      branch.branchId,
      isParent,
    );
  }

  @Get(':id')
  async getLeaveRequestById(
    @Param('id') id: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.getLeaveRequestById(
      id,
      branch.branchId,
    );
    return { data };
  }

  @Post()
  async createLeaveRequest(
    @Body() input: CreateLeaveRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.createLeaveRequest(
      input,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/approve')
  async approveLeaveRequest(
    @Param('id') id: string,
    @Body() input: UpdateLeaveStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.updateLeaveStatus(
      id,
      { ...input, status: 'approved' },
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/reject')
  async rejectLeaveRequest(
    @Param('id') id: string,
    @Body() input: UpdateLeaveStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.updateLeaveStatus(
      id,
      { ...input, status: 'rejected' },
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/cancel')
  async cancelLeaveRequest(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.cancelLeaveRequest(
      id,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Get('quota/:studentId')
  async getStudentQuotaUsage(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.getStudentQuotaUsage(
      studentId,
      branch.branchId,
    );
    return { data };
  }

  @Get('stats/:studentId')
  async getLeaveStats(
    @Param('studentId') studentId: string,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.leaveRequestsService.getLeaveStats(
      studentId,
      branch.branchId,
    );
    return { data };
  }
}


