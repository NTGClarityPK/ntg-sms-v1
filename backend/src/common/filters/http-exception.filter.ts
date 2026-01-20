import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseMessage = (exceptionResponse as { message?: string | string[] }).message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : responseMessage || message;
        code =
          (exceptionResponse as { code?: string }).code ||
          exception.name ||
          code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name;
    }

    // Log the error
    this.logger.error(
      `HTTP ${status} Error: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
      `${request.method} ${request.url}`,
    );

    // Return consistent error format
    response.status(status).json({
      error: {
        code,
        message: Array.isArray(message) ? message.join(', ') : message,
      },
    });
  }
}

