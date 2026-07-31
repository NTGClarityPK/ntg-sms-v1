import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class SchoolAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUserPayload }>();
    const user = request.user;
    const roles = user?.roles ?? [];
    const isSchoolAdmin = roles.some((r) => r.toLowerCase() === 'school_admin');
    if (isSchoolAdmin) {
      return true;
    }
    throw new ForbiddenException('Only school administrators can access billing');
  }
}
