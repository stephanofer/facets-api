import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { SentryExceptionCaptured } from '@sentry/nestjs';
import { ERROR_CODES } from '@common/constants/app.constants';
import { ErrorResponse } from '@common/interfaces/api-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  @SentryExceptionCaptured()
  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    const { status, code, message, details } = this.parseException(exception);

    const responseBody: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.id,
      },
    };

    // Log 5xx errors
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }

  private parseException(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();

      if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;

        // Handle validation errors from class-validator
        if (Array.isArray(responseObj.message)) {
          return {
            status,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Validation failed',
            details: responseObj.message.map((msg: string) => ({
              message: msg,
            })),
          };
        }

        // Handle BusinessException
        if (responseObj.code) {
          return {
            status,
            code: responseObj.code as string,
            message: responseObj.message as string,
            details: responseObj.details as Array<{
              field?: string;
              message: string;
            }>,
          };
        }

        return {
          status,
          code: this.getErrorCodeFromStatus(status),
          message: (responseObj.message as string) || exception.message,
        };
      }

      return {
        status,
        code: this.getErrorCodeFromStatus(status),
        message: exception.message,
      };
    }

    // Unknown error
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }

  private getErrorCodeFromStatus(status: number): string {
    const statusToCode: Record<number, string> = {
      400: ERROR_CODES.VALIDATION_ERROR,
      401: ERROR_CODES.UNAUTHORIZED,
      403: ERROR_CODES.FORBIDDEN,
      404: ERROR_CODES.RESOURCE_NOT_FOUND,
      409: ERROR_CODES.CONFLICT,
      429: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      500: ERROR_CODES.INTERNAL_ERROR,
    };

    return statusToCode[status] || ERROR_CODES.INTERNAL_ERROR;
  }
}
