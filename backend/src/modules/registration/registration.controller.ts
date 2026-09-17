import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegistrationService } from './registration.service';
import { SignupEmailVerificationService } from './signup-email-verification.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import {
  SendSignupEmailCodeDto,
  VerifySignupEmailCodeDto,
} from './dto/signup-email-verification.dto';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class RegistrationController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly signupEmailVerificationService: SignupEmailVerificationService,
  ) {}

  @Get('check-domain')
  async checkDomain(@Query('domain') domain?: string): Promise<{
    data: { domain: string; available: boolean; normalized: string };
  }> {
    return this.registrationService.checkDomainAvailability(domain ?? '');
  }

  @Get('check-code')
  async checkCode(@Query('code') code?: string): Promise<{
    data: { code: string; available: boolean; normalized: string };
  }> {
    return this.registrationService.checkCodeAvailability(code ?? '');
  }

  @Post('signup/send-email-code')
  async sendSignupEmailCode(@Body() body: SendSignupEmailCodeDto) {
    return this.signupEmailVerificationService.sendCode(body);
  }

  @Post('signup/verify-email-code')
  async verifySignupEmailCode(@Body() body: VerifySignupEmailCodeDto) {
    return this.signupEmailVerificationService.verifyCode(body);
  }

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<{ data: RegisterResponseDto }> {
    const result = await this.registrationService.register(body);
    return { data: result };
  }
}
