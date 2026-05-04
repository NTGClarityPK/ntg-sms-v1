import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegistrationService } from './registration.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterResponseDto } from './dto/register-response.dto';

@ApiTags('Authentication')
@Controller('api/v1/auth')
export class RegistrationController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('register')
  async register(@Body() body: RegisterDto): Promise<{ data: RegisterResponseDto }> {
    const result = await this.registrationService.register(body);
    return { data: result };
  }
}


