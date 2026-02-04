import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@config/config.service';
import { UsersService } from '@modules/users/users.service';
import { JwtPayload } from '@modules/auth/dtos/auth-response.dto';

/**
 * JWT Strategy for validating access tokens
 *
 * This strategy extracts the JWT from the Authorization header (Bearer scheme),
 * validates it using the access token secret, and attaches the user to the request.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const accessSecret = configService.jwt.accessSecret;
    if (!accessSecret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  /**
   * Validate the JWT payload and return the user
   *
   * This method is called after the JWT signature is verified.
   * The returned value will be attached to request.user
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Verify the user still exists and is active
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const loginStatus = this.usersService.canLogin(user);
    if (!loginStatus.allowed) {
      throw new UnauthorizedException(
        loginStatus.reason || 'Account not accessible',
      );
    }

    // Return the payload (will be attached to request.user)
    return {
      sub: payload.sub,
      email: payload.email,
    };
  }
}
