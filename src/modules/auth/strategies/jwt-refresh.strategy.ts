import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@config/config.service';
import { RefreshTokenPayload } from '@modules/auth/dtos/auth-response.dto';

/**
 * JWT Refresh Strategy for validating refresh tokens
 *
 * This strategy extracts the refresh token from the request body,
 * validates it using the refresh token secret, and returns the payload
 * for further validation in the AuthService.
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
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
      passReqToCallback: true,
    });
  }

  /**
   * Validate the refresh token payload
   *
   * The actual token validation (checking if revoked, etc.) is done in AuthService.
   * This just verifies the JWT signature and extracts the payload.
   */
  validate(
    req: Request,
    payload: RefreshTokenPayload,
  ): RefreshTokenPayload & { refreshToken: string } {
    const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;

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
