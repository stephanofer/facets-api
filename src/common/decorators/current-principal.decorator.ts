import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';

export const CurrentPrincipal = createParamDecorator(
  (
    data: keyof AuthenticatedPrincipal | undefined,
    ctx: ExecutionContext,
  ):
    | AuthenticatedPrincipal
    | AuthenticatedPrincipal[keyof AuthenticatedPrincipal]
    | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const principal = request.user as AuthenticatedPrincipal;

    return data ? principal?.[data] : principal;
  },
);
