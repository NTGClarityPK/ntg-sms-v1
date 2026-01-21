import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { UserResponseDto } from './dto/user-response.dto';
import { BranchSummaryDto } from './dto/branch-summary.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UserResponseDto }> {
    const userData = await this.authService.getCurrentUser(user.id);
    return { data: userData };
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UserResponseDto }> {
    const userData = await this.authService.getCurrentUser(user.id);
    return { data: userData };
  }

  @Get('my-branches')
  @UseGuards(JwtAuthGuard)
  async myBranches(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: BranchSummaryDto[] }> {
    const branches = await this.authService.getMyBranches(user.id);
    return { data: branches };
  }

  @Post('select-branch')
  @UseGuards(JwtAuthGuard)
  async selectBranch(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { branchId: string },
  ): Promise<{ data: BranchSummaryDto }> {
    const selected = await this.authService.selectBranch(user.id, body.branchId);
    return { data: selected };
  }

  @Get('current-branch')
  @UseGuards(JwtAuthGuard)
  async currentBranch(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: BranchSummaryDto | null }> {
    const current = await this.authService.getCurrentBranch(user.id);
    return { data: current };
  }
}

