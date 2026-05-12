import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseConfig } from '../config/supabase.config';
import {
  isSupabaseConnectivityError,
  SUPABASE_CONNECTIVITY_USER_MESSAGE,
} from '../utils/supabase-connectivity-error.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly supabaseConfig: SupabaseConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const supabase = this.supabaseConfig.getClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        if (isSupabaseConnectivityError(error ?? undefined)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        throw new UnauthorizedException('Invalid or expired token');
      }

      const email = user.email ?? '';

      // Fetch application roles from user_roles table
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id);

      if (rolesError) {
        if (isSupabaseConnectivityError(rolesError)) {
          throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
        }
        this.logger.warn(`Failed to fetch user roles: ${rolesError.message}`);
      }

      const roles = (userRoles || [])
        .map((ur) => {
          const roleData = ur.roles as unknown;
          if (roleData && typeof roleData === 'object' && 'name' in roleData) {
            return (roleData as { name: string }).name;
          }
          return null;
        })
        .filter((name): name is string => !!name);

      // Local/dev super admin shortcut for admin portal access.
      // This is intentionally email-domain based so the admin portal does not depend on DB role seeding.
      if (email.endsWith('@superuser.com') && !roles.includes('super_admin')) {
        roles.push('super_admin');
      }

      await this.ensureUserIsActive({
        userId: user.id,
        roles,
      });

      // Attach user info to request
      request['user'] = {
        id: user.id,
        email,
        roles,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (isSupabaseConnectivityError(error)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
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

  private async ensureUserIsActive(input: {
    userId: string;
    roles: string[];
  }): Promise<void> {
    const supabase = this.supabaseConfig.getClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', input.userId)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      if (isSupabaseConnectivityError(profileError)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
      this.logger.warn(`Failed to fetch profile status: ${profileError.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const isProfileInactive = (profile as { is_active?: boolean | null } | null)?.is_active === false;
    if (isProfileInactive) {
      throw new ForbiddenException(
        'Your account has been marked as inactive by an administrator. Please contact your school if you need help.',
      );
    }

    const isStudentUser = input.roles.some((role) => role.toLowerCase() === 'student');
    if (!isStudentUser) return;

    const { data: studentRows, error: studentRowsError } = await supabase
      .from('students')
      .select('is_active')
      .eq('user_id', input.userId);

    if (studentRowsError) {
      if (isSupabaseConnectivityError(studentRowsError)) {
        throw new ServiceUnavailableException(SUPABASE_CONNECTIVITY_USER_MESSAGE);
      }
      this.logger.warn(`Failed to fetch student status: ${studentRowsError.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hasInactiveStudent = ((studentRows || []) as Array<{ is_active: boolean }>).some(
      (row) => row.is_active === false,
    );
    if (hasInactiveStudent) {
      throw new ForbiddenException(
        'Your account has been marked as inactive by an administrator. Please contact your school if you need help.',
      );
    }
  }
}

