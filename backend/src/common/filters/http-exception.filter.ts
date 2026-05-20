import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type MulterLikeError = Error & { code?: string };

/** Path without query string (Express sets `path`; fallback for odd adapters). */
function requestPath(request: Request): string {
  if (request.path && request.path.length > 0) {
    return request.path;
  }
  const raw = request.url ?? '';
  const q = raw.indexOf('?');
  return q === -1 ? raw : raw.slice(0, q);
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    const errorDetails: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        const responseMessage = resp.message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : typeof responseMessage === 'string'
            ? responseMessage
            : message;
        code =
          (typeof resp.code === 'string' ? resp.code : undefined) ||
          exception.name ||
          code;

        for (const key of [
          'reasons',
          'metric',
          'limit',
          'used',
          'feature',
        ] as const) {
          if (resp[key] !== undefined) {
            errorDetails[key] = resp[key];
          }
        }
      }
    } else if (
      exception instanceof Error &&
      exception.name === 'MulterError' &&
      (exception as MulterLikeError).code === 'LIMIT_FILE_SIZE'
    ) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'File size must not exceed 100MB';
      code = 'LIMIT_FILE_SIZE';
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name;
    }

    const path = requestPath(request);
    const isLogoutStyleAuthMe =
      status === HttpStatus.UNAUTHORIZED &&
      request.method === 'GET' &&
      path === '/api/v1/auth/me' &&
      message === 'No token provided';

    // Session checks without a bearer token are normal after logout / before login — avoid ERROR + stack noise
    if (isLogoutStyleAuthMe) {
      this.logger.log(
        `Logout happened — GET /api/v1/auth/me with no bearer token (expected 401).`,
      );
    } else {
      this.logger.error(
        `HTTP ${status} Error: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
        `${request.method} ${request.url}`,
      );
    }

    // Return consistent error format
    response.status(status).json({
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
        ...errorDetails,
      },
    });
  }
}

