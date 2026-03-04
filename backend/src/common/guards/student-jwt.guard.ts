import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

interface StudentJwtPayload {
  sub?: string;
  role?: string;
  purpose?: string;
  student_id: string;
  branch_id: string;
  school_id?: string;
}

@Injectable()
export class StudentJwtGuard implements CanActivate {
  private readonly logger = new Logger(StudentJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync<StudentJwtPayload>(token);

      if (payload.role !== 'authenticated' || payload.purpose !== 'student-db') {
        throw new UnauthorizedException('Invalid token context');
      }

      if (!payload.student_id || !payload.branch_id) {
        throw new UnauthorizedException('Missing student context');
      }

      (request as Request & { student?: { id: string; branchId: string; schoolId?: string } }).student = {
        id: payload.student_id,
        branchId: payload.branch_id,
        schoolId: payload.school_id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Student JWT validation failed: ${message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

