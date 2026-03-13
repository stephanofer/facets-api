import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPrincipal } from '@modules/auth/interfaces/authenticated-principal.interface';
import { User } from '../../generated/prisma/client';

type CurrentUserData = keyof User;

export const CurrentUser = createParamDecorator(
  (
    data: CurrentUserData | undefined,
    ctx: ExecutionContext,
  ): User | User[keyof User] | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const principal = request.user as AuthenticatedPrincipal | undefined;
    const user = principal?.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  },
);
