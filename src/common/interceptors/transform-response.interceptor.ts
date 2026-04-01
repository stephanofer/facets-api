import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@common/interfaces/api-response.interface';
import {
  SKIP_ERROR_ENVELOPE_KEY,
  SKIP_RESPONSE_ENVELOPE_KEY,
} from '@common/decorators/raw-response.decorator';

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context
      .switchToHttp()
      .getRequest<Record<string, boolean | undefined>>();

    request[SKIP_ERROR_ENVELOPE_KEY] =
      this.reflector.getAllAndOverride<boolean>(SKIP_ERROR_ENVELOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    const skipResponseEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_RESPONSE_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipResponseEnvelope) {
      return next.handle() as Observable<ApiResponse<T>>;
    }

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data: data?.data ?? data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(data?.meta && { pagination: data.meta }),
        },
      })),
    );
  }
}
