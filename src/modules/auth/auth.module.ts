import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from '@modules/auth/auth.controller';
import { AuthService } from '@modules/auth/auth.service';
import { RefreshTokensRepository } from '@modules/auth/refresh-tokens.repository';
import { JwtStrategy } from '@modules/auth/strategies/jwt.strategy';
import { JwtRefreshStrategy } from '@modules/auth/strategies/jwt-refresh.strategy';
import { UsersModule } from '@modules/users/users.module';
import { OtpModule } from '@modules/otp/otp.module';
import { SubscriptionsModule } from '@modules/subscriptions/subscriptions.module';
import { MailModule } from '@mail/mail.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Secrets are provided per-sign in AuthService
    UsersModule,
    OtpModule,
    SubscriptionsModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokensRepository,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
