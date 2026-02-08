import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@config/config.service';
import { UsersService } from '@modules/users/users.service';
import { JwtPayload } from '@modules/auth/dtos/auth-response.dto';
import { User } from '../../../generated/prisma/client';

/**
 * Authenticated user attached to request.user by Passport
 *
 * Extends JwtPayload with the full User entity so downstream
 * controllers/services don't need to re-query the database.
 */
export interface AuthenticatedUser extends JwtPayload {
  user: User;
}

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
   * Validate the JWT payload and return the authenticated user
   *
   * This method is called after the JWT signature is verified.
   * Returns the full user entity alongside JWT fields so controllers
   * don't need to re-query the database.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
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

    // Return payload + full user (attached to request.user)
    return {
      sub: payload.sub,
      email: payload.email,
      user,
    };
  }
}
