import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error('JWT_SECRET is missing from environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: string;
    role: string;
    tokenVersion: number;
    tokenType?: string;
    purpose?: string;
  }) {
    if (
      !payload.sub ||
      payload.tokenType === 'refresh' ||
      payload.tokenType === 'password_reset' ||
      Boolean(payload.purpose)
    ) {
      throw new UnauthorizedException(this.i18n.t('auth.invalid_token'));
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        this.i18n.t('auth.user_not_found'),
      );
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException(this.i18n.t('auth.email_not_verified'));
    }

    if (
      typeof payload.tokenVersion !== 'number' ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException(
        this.i18n.t('auth.session_revoked'),
      );
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
