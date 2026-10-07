import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { AdminLogsService } from '../admin-logs.service';

@Injectable()
export class ApiHitsInterceptor implements NestInterceptor {
  constructor(private readonly logsService: AdminLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & { branch?: { tenantId?: string }; user?: { tenantId?: string } }
    >();
    const response = http.getResponse<Response>();
    const started = Date.now();

    // Skip logging admin Ops traffic itself (noise + key leakage risk)
    if (request.path?.includes('/api/v1/admin')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          void this.logsService.recordHit({
            tenantId:
              request.branch?.tenantId ?? request.user?.tenantId ?? null,
            method: request.method,
            url: request.originalUrl || request.url,
            statusCode: response.statusCode,
            responseTimeMs: Date.now() - started,
            actionType: `${request.method} ${request.route?.path ?? request.path}`,
          });
        },
        error: (err: { status?: number; statusCode?: number }) => {
          void this.logsService.recordHit({
            tenantId:
              request.branch?.tenantId ?? request.user?.tenantId ?? null,
            method: request.method,
            url: request.originalUrl || request.url,
            statusCode: err?.status ?? err?.statusCode ?? 500,
            responseTimeMs: Date.now() - started,
            actionType: `${request.method} ${request.route?.path ?? request.path}`,
          });
        },
      }),
    );
  }
}
