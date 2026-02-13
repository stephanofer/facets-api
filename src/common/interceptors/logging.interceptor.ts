import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { REFRESH_TOKEN_COOKIE_NAME } from '@modules/auth/strategies/jwt-refresh.strategy';
import { ACCESS_TOKEN_COOKIE_NAME } from '@modules/auth/strategies/jwt.strategy';

type AuthSource = 'Bearer' | 'Cookie' | 'None';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const now = Date.now();

    const authSource = this.detectAuthSource(request);
    const clientType = authSource === 'Cookie' ? 'Web' : 'Mobile/API';

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const { statusCode } = response;
        const duration = Date.now() - now;

        this.logger.log(
          `${method} ${url} ${statusCode} - ${duration}ms | Auth: ${authSource} (${clientType})`,
        );
      }),
    );
  }

  /**
   * Detect how the request is being authenticated
   *
   * - Bearer: access token in Authorization header (mobile/native clients)
   * - Cookie: refresh token in HttpOnly cookie (web clients)
   * - None: no authentication present (public routes)
   */
  private detectAuthSource(request: Request): AuthSource {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return 'Bearer';
    }

    const cookies = request.cookies as Record<string, string | undefined>;
    if (
      cookies?.[ACCESS_TOKEN_COOKIE_NAME] ||
      cookies?.[REFRESH_TOKEN_COOKIE_NAME]
    ) {
      return 'Cookie';
    }

    return 'None';
  }
}
