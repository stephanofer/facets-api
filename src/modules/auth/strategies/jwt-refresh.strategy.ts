import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@config/config.service';
import { RefreshTokenPayload } from '@modules/auth/dtos/auth-response.dto';

/**
 * Cookie name for the refresh token (HttpOnly, web clients)
 */
export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

/**
 * JWT Refresh Strategy for validating refresh tokens
 *
 * Supports TWO extraction methods for multi-platform compatibility:
 * 1. HttpOnly cookie (web clients) — secure against XSS
 * 2. Request body (mobile/native clients) — stored in device Secure Storage
 *
 * Cookie is checked first; if not present, falls back to body.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly configService: ConfigService) {
    const refreshSecret = configService.jwt.refreshSecret;
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Priority 1: HttpOnly cookie (web clients)
        (req: Request) =>
          (req.cookies as Record<string, string | undefined>)?.[
            REFRESH_TOKEN_COOKIE_NAME
          ] ?? null,
        // Priority 2: Request body (mobile/native clients)
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  /**
   * Validate the refresh token payload
   *
   * Extracts the raw refresh token from cookie or body for hash comparison
   * in AuthService. The actual token validation (checking if revoked, etc.)
   * is done in AuthService.
   */
  validate(
    req: Request,
    payload: RefreshTokenPayload,
  ): RefreshTokenPayload & { refreshToken: string } {
    // Try cookie first, then body
    const refreshToken =
      (req.cookies as Record<string, string | undefined>)?.[
        REFRESH_TOKEN_COOKIE_NAME
      ] ?? (req.body as { refreshToken?: string })?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (!payload.tokenId) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Return payload with the raw token for hash comparison in AuthService
    return {
      ...payload,
      refreshToken,
    };
  }
}
