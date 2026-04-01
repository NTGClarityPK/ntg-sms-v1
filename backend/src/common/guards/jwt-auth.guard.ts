import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseConfig } from '../config/supabase.config';

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
        throw new UnauthorizedException('Invalid or expired token');
      }

      const email = user.email ?? '';

      // Fetch application roles from user_roles table
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user.id);

      if (rolesError) {
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

      // Attach user info to request
      request['user'] = {
        id: user.id,
        email,
        roles,
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

