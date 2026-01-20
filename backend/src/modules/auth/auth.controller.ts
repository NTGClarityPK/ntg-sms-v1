import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { UserResponseDto } from './dto/user-response.dto';

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
}

