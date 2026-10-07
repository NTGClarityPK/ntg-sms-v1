import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    // Attach the effective branch context (resolved by BranchGuard) to every response
    // so the frontend can recover from stale localStorage branch IDs.
    try {
      const http = context.switchToHttp();
      const req = http.getRequest() as { branch?: { branchId?: string; tenantId?: string | null } };
      const res = http.getResponse() as { setHeader?: (name: string, value: string) => void };
      const branchId = req?.branch?.branchId;
      const tenantId = req?.branch?.tenantId;
      if (branchId && typeof res?.setHeader === 'function') {
        res.setHeader('X-Effective-Branch-Id', branchId);
      }
      if (tenantId && typeof res?.setHeader === 'function') {
        res.setHeader('X-Effective-Tenant-Id', tenantId);
      }
    } catch {
      // Non-blocking
    }

    // Ops Alma / Reach admin API expects flat JSON (not { data: ... }) for
    // assessments-lock, subscription detail, delete, etc. List tenants already
    // returns { data: [...] } which passes through.
    const reqPath =
      (context.switchToHttp().getRequest() as { path?: string; url?: string })
        ?.path ??
      (context.switchToHttp().getRequest() as { url?: string })?.url ??
      '';
    const isAdminOps =
      typeof reqPath === 'string' && reqPath.includes('/api/v1/admin');

    return next.handle().pipe(
      map((data) => {
        if (isAdminOps) {
          return data as Response<T>;
        }

        // If data already has the correct format, return as is
        if (data && typeof data === 'object' && 'data' in data) {
          return data as Response<T>;
        }

        // Otherwise, wrap in standard format
        return {
          data,
        };
      }),
    );
  }
}

