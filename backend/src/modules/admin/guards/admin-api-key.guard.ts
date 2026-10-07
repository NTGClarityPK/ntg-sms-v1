import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const configured = this.configService.get<string>('ADMIN_API_KEY')?.trim();
    if (!configured) {
      throw new ServiceUnavailableException('Admin API key is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided =
      (request.headers['x-api-key'] as string | undefined)?.trim() ?? '';

    if (!provided || provided !== configured) {
      throw new UnauthorizedException('Invalid or missing admin API key');
    }
    return true;
  }
}
