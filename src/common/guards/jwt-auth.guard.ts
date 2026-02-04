import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

/**
 * JWT Authentication Guard
 *
 * This guard extends Passport's AuthGuard for the 'jwt' strategy.
 * It checks for the @Public() decorator to skip authentication on public routes.
 *
 * Usage:
 * - Apply globally in main.ts or AppModule for app-wide protection
 * - Use @Public() decorator on routes that should be publicly accessible
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Check if the route is public or requires authentication
   */
  canActivate(context: ExecutionContext) {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Delegate to Passport's JWT strategy
    return super.canActivate(context);
  }
}
