import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@config/config.service';
import { PrismaService } from '@database/prisma.service';
import { UsersService } from '@modules/users/users.service';
import { JwtPayload } from '@modules/auth/dtos/auth-response.dto';
import { WorkspaceMembershipStatus } from '@/generated/prisma/client';
import {
  AuthenticatedPrincipal,
  AuthenticatedUser,
} from '@modules/auth/interfaces/authenticated-principal.interface';

/**
 * Cookie name for the access token (HttpOnly, web clients)
 */
export const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';

/**
 * Transitional re-export kept for compatibility while the app migrates.
 */
export type { AuthenticatedPrincipal, AuthenticatedUser };

/**
 * JWT Strategy for validating access tokens
 *
 * Supports TWO extraction methods for multi-platform compatibility:
 * 1. Authorization header (Bearer scheme) — mobile/native clients (PRIORITY)
 * 2. HttpOnly cookie (web clients) — secure against XSS (FALLBACK)
 *
 * Mobile-first: Bearer header is checked first. If not present, falls back to cookie.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {
    const accessSecret = configService.jwt.accessSecret;
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Priority 1: Bearer token from Authorization header (mobile/native clients)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Priority 2: HttpOnly cookie (web clients)
        (req: Request) =>
          (req.cookies as Record<string, string | undefined>)?.[
            ACCESS_TOKEN_COOKIE_NAME
          ] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  /**
   * Validate the JWT payload and return the authenticated user
   *
   * This method is called after the JWT signature is verified.
   * Returns the full user entity alongside JWT fields so controllers
   * don't need to re-query the database.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedPrincipal> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        id: payload.membershipId,
        userId: payload.sub,
        workspaceId: payload.workspaceId,
        status: WorkspaceMembershipStatus.ACTIVE,
        workspace: {
          status: 'ACTIVE',
        },
      },
      include: {
        user: true,
        workspace: true,
      },
    });

    const user = membership?.user;

    if (!membership || !user) {
      throw new UnauthorizedException('Workspace membership not found');
    }

    const loginStatus = this.usersService.canLogin(user);
    if (!loginStatus.allowed) {
      throw new UnauthorizedException(
        loginStatus.reason || 'Account not accessible',
      );
    }

    // Return payload + full user (attached to request.user)
    return {
      sub: user.id,
      email: user.email,
      workspaceId: membership.workspaceId,
      actorUserId: user.id,
      membershipId: membership.id,
      workspaceRole: membership.role,
      platformRole: user.platformRole,
      user,
      workspace: membership.workspace,
      membership,
    };
  }
}
