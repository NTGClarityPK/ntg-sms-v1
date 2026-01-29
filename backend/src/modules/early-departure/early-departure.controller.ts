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
import { EarlyDepartureService } from './early-departure.service';
import { CreateEarlyDepartureRequestDto } from './dto/create-early-departure.dto';
import { UpdateEarlyDepartureStatusDto } from './dto/update-early-departure-status.dto';
import { QueryEarlyDepartureRequestsDto } from './dto/query-early-departure.dto';

@Controller('api/v1/early-departures')
@UseGuards(JwtAuthGuard, BranchGuard)
export class EarlyDepartureController {
  constructor(private readonly earlyDepartureService: EarlyDepartureService) {}

  @Get()
  async listEarlyDepartureRequests(
    @Query() query: QueryEarlyDepartureRequestsDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    return this.earlyDepartureService.listEarlyDepartureRequests(
      query,
      user.id,
      branch.branchId,
    );
  }

  @Post()
  async createEarlyDepartureRequest(
    @Body() input: CreateEarlyDepartureRequestDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.earlyDepartureService.createEarlyDepartureRequest(
      input,
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/approve')
  async approveEarlyDepartureRequest(
    @Param('id') id: string,
    @Body() input: UpdateEarlyDepartureStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.earlyDepartureService.updateEarlyDepartureStatus(
      id,
      { ...input, status: 'approved' },
      user.id,
      branch.branchId,
    );
    return { data };
  }

  @Put(':id/reject')
  async rejectEarlyDepartureRequest(
    @Param('id') id: string,
    @Body() input: UpdateEarlyDepartureStatusDto,
    @CurrentUser() user: CurrentUserPayload,
    @CurrentBranch() branch: { branchId: string },
  ) {
    const data = await this.earlyDepartureService.updateEarlyDepartureStatus(
      id,
      { ...input, status: 'rejected' },
      user.id,
      branch.branchId,
    );
    return { data };
  }
}


