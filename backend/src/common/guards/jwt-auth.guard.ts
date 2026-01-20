import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  email: string;
  role?: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const jwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
      if (!jwtSecret) {
        throw new Error('SUPABASE_JWT_SECRET not configured');
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtSecret,
      });

      // Attach user info to request
      request['user'] = {
        id: payload.sub,
        email: payload.email,
        roles: payload.role ? [payload.role] : [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`JWT validation failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

