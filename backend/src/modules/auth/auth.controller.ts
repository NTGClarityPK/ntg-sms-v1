import { Body, Controller, Get, Post, Put, UseGuards, Res, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { UserResponseDto } from './dto/user-response.dto';
import { BranchSummaryDto } from './dto/branch-summary.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('api/v1/auth')
@ApiTags('Authentication')
@ApiBearerAuth()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  async redirectToGoogle(
    @Res() res: Response,
    @Query('gstate') gstate?: string,
  ): Promise<void> {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!supabaseUrl || !frontendUrl) {
      res.status(500).json({
        error: {
          code: 'GoogleAuthNotConfigured',
          message: 'Google authentication is not configured on the server.',
        },
      });
      return;
    }

    const redirectToUrl = new URL('/auth/callback', frontendUrl);
    if (gstate) {
      redirectToUrl.searchParams.set('gstate', gstate);
    }
    const redirectTo = redirectToUrl.toString();
    const url = new URL('/auth/v1/authorize', supabaseUrl);
    url.searchParams.set('provider', 'google');
    url.searchParams.set('redirect_to', redirectTo);

    res.redirect(url.toString());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UserResponseDto }> {
    const userData = await this.authService.getCurrentUser(user.id, {
      email: user.email,
      roleNames: user.roles ?? [],
    });
    return { data: userData };
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UserResponseDto }> {
    const userData = await this.authService.getCurrentUser(user.id, {
      email: user.email,
      roleNames: user.roles ?? [],
    });
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

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: ProfileResponseDto }> {
    const profile = await this.authService.getProfile(user.id);
    return { data: profile };
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: UpdateProfileDto,
  ): Promise<{ data: ProfileResponseDto }> {
    const profile = await this.authService.updateProfile(user.id, body);
    return { data: profile };
  }

  @Post('select-child')
  @UseGuards(JwtAuthGuard)
  async selectChild(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { studentId: string },
  ): Promise<{ data: { success: boolean } }> {
    await this.authService.selectChild(user.id, body.studentId);
    return { data: { success: true } };
  }

  @Get('current-child')
  @UseGuards(JwtAuthGuard)
  async currentChild(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: { id: string; studentId: string; firstName: string; lastName: string } | null;
  }> {
    const current = await this.authService.getCurrentChild(user.id);
    return { data: current };
  }

  @Get('my-children')
  @UseGuards(JwtAuthGuard)
  async myChildren(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    data: Array<{
      id: string;
      studentId: string;
      firstName: string;
      lastName: string;
      branchId: string | null;
      isCurrent: boolean;
    }>;
  }> {
    const children = await this.authService.listMyChildren(user.id);
    return { data: children };
  }

  @Post('verify-child-email')
  @UseGuards(JwtAuthGuard)
  async verifyChildEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { studentId: string; email: string },
  ): Promise<{ data: { valid: boolean } }> {
    await this.authService.verifyChildEmail(user.id, body.studentId, body.email);
    return { data: { valid: true } };
  }

  @Post('switch-child')
  @UseGuards(JwtAuthGuard)
  async switchChild(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { studentId: string },
  ): Promise<{
    data: {
      token: string;
      student: {
        id: string;
        studentId: string;
        firstName: string;
        lastName: string;
        branchId: string | null;
      };
    };
  }> {
    const result = await this.authService.switchChild(user.id, body.studentId);
    return { data: result };
  }

  /**
   * Bootstrap a Google-authenticated user with a default school / branch / role if needed.
   * Idempotent: if the user already has branches, it simply returns the current user payload.
   */
  @Post('bootstrap-google')
  @UseGuards(JwtAuthGuard)
  async bootstrapGoogle(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ data: UserResponseDto }> {
    const userData = await this.authService.bootstrapGoogleUser(user.id);
    return { data: userData };
  }

  /**
   * Provision a Google-signup user using school/branch/admin data captured during signup.
   * Called after Google OAuth completes, when the Supabase session is already established.
   */
  @Post('google-signup')
  @UseGuards(JwtAuthGuard)
  async googleSignup(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      schoolName: string;
      branchName: string;
      fullName: string;
      phone?: string | null;
    },
  ): Promise<{ data: UserResponseDto }> {
    const userData = await this.authService.googleSignupProvision(user.id, {
      schoolName: body.schoolName,
      branchName: body.branchName,
      fullName: body.fullName,
      phone: body.phone ?? null,
    });
    return { data: userData };
  }
}
