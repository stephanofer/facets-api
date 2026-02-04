import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Timing thresholds for request performance analysis
 */
const TIMING_THRESHOLDS = {
  /** Requests taking longer than this (ms) will log a warning */
  SLOW: 500,
  /** Requests taking longer than this (ms) will log an error */
  VERY_SLOW: 2000,
} as const;

/**
 * TimingInterceptor - Detailed request timing for performance debugging
 *
 * Logs detailed timing information for all requests:
 * - Fast requests (< 500ms): DEBUG level
 * - Slow requests (500-2000ms): WARN level with details
 * - Very slow requests (> 2000ms): ERROR level with full context
 *
 * Usage:
 * Enable globally in main.ts or per-controller with @UseInterceptors
 *
 * @example
 * // Global usage in main.ts
 * app.useGlobalInterceptors(new TimingInterceptor());
 *
 * // Per-controller usage
 * @UseInterceptors(TimingInterceptor)
 * @Controller('users')
 * export class UsersController {}
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body } = request;
    const startTime = Date.now();
    const controller = context.getClass().name;
    const handler = context.getHandler().name;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logTiming(
            method,
            url,
            startTime,
            controller,
            handler,
            context.switchToHttp().getResponse<Response>().statusCode,
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[TIMING ERROR] ${method} ${url} - ${duration}ms - ${controller}.${handler} - Error: ${error.message}`,
          );
        },
      }),
    );
  }

  private logTiming(
    method: string,
    url: string,
    startTime: number,
    controller: string,
    handler: string,
    statusCode: number,
  ): void {
    const duration = Date.now() - startTime;
    const routeInfo = `${controller}.${handler}`;

    if (duration >= TIMING_THRESHOLDS.VERY_SLOW) {
      // Very slow request - ERROR level
      this.logger.error(
        `[VERY SLOW] ${method} ${url} - ${duration}ms - ${routeInfo} - Status: ${statusCode}`,
      );
    } else if (duration >= TIMING_THRESHOLDS.SLOW) {
      // Slow request - WARN level
      this.logger.warn(
        `[SLOW] ${method} ${url} - ${duration}ms - ${routeInfo} - Status: ${statusCode}`,
      );
    } else {
      // Normal request - DEBUG level
      this.logger.debug(
        `${method} ${url} - ${duration}ms - ${routeInfo} - Status: ${statusCode}`,
      );
    }
  }
}
