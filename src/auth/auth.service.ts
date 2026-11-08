import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { OAuth2Client } from 'google-auth-library';
import { compare, hash } from 'bcryptjs';
import { EmailOtp } from './otp.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from '../i18n/i18n.service';
import { LanguageInfo, SupportedLanguage } from '../i18n/i18n.types';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetPasswordOtpDto } from './dto/verify-reset-password-otp.dto';
import { validatePhoneForCountry } from './phone-validation.util';
import { ChangeEmailDto } from './dto/change-email.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { AuthSession } from './auth-session.entity';

type AuthResponse = {
  message?: string;
  accessToken: string;
  refreshToken: string;
  data: ReturnType<AuthService['sanitizeUser']>;
};

@Injectable()
export class AuthService {
  private readonly resend: Resend;
  private readonly googleClient: OAuth2Client;

  constructor(
    @InjectRepository(EmailOtp)
    private readonly otpRepository: Repository<EmailOtp>,
    @InjectRepository(AuthSession)
    private readonly sessionsRepository: Repository<AuthSession>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing from environment variables');
    }

    this.resend = new Resend(apiKey);
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  private getPepper(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is missing from environment variables');
    }
    return secret;
  }

  private hashOtp(target: string, code: string): string {
    return createHash('sha256')
      .update(`${this.getPepper()}:${target}:${code}`)
      .digest('hex');
  }

  private safeCompareHash(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private validateE164Phone(countryCode?: string | null, phone?: string | null) {
    if (!countryCode || !phone) return;
    const cleanCountry = countryCode.trim().replace('+', '');
    const cleanPhone = phone.trim();
    if (!/^\d+$/.test(cleanCountry) || !/^\d+$/.test(cleanPhone)) {
      throw new BadRequestException(this.i18n.t('auth.e164_digits_only'));
    }
    const result = validatePhoneForCountry(countryCode, phone);
    if (!result.isValid) {
      const isArabic = this.i18n.getCurrentLanguage() === 'ar';
      throw new BadRequestException(
        (isArabic ? result.messageAr : result.messageEn) ||
          this.i18n.t('auth.e164_invalid'),
      );
    }
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      phone: user.phone ?? null,
      countryCode: user.countryCode ?? null,
      profileUrl: user.profileUrl ?? null,
      birthday: user.birthday ?? null,
      country: this.i18n.formatCountry(user.country) ?? user.country ?? null,
      aboutMe: user.aboutMe ?? null,
      role: user.role,
      emailVerified: user.emailVerified,
      profileCompleted: Boolean(user.profileCompleted),
      interestsSelected: Boolean(user.interestsSelected),
      authorsSelected: Boolean(user.authorsSelected),
      creatorsSelected: Boolean(user.creatorsSelected),
      followersCount: user.followersCount ?? 0,
      followingCount: user.followingCount ?? 0,
      acceptTerms: Boolean(user.acceptTerms),
      language: (user.language as SupportedLanguage) ?? 'ar',
      readingLanguage: this.i18n.formatReadingLanguage(user.readingLanguage) ?? null,
      userType: user.userType ?? 'Reader',
      createdAt: user.createdAt,
    };
  }

  private async generateTokens(user: { id: string; role: string; tokenVersion: number }, sessionId: string, refreshId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessTokenExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
      this.configService.get<string>('JWT_EXPIRES_IN') ??
      '15m';
    const refreshTokenExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessTokenExpiresIn as any,
      }),
      this.jwtService.signAsync(
        { ...payload, tokenType: 'refresh', sid: sessionId, jti: refreshId },
        {
          expiresIn: refreshTokenExpiresIn as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueSession(user: { id: string; role: string; tokenVersion: number }) {
    if (randomInt(100) === 0) {
      await this.sessionsRepository
        .createQueryBuilder()
        .delete()
        .where('expires_at <= now() OR consumed_at IS NOT NULL OR revoked_at IS NOT NULL')
        .execute();
    }
    const sessionId = randomUUID();
    const refreshId = randomUUID();
    const tokens = await this.generateTokens(user, sessionId, refreshId);
    const decoded = this.jwtService.decode(tokens.refreshToken) as { exp?: number } | null;
    if (!decoded?.exp) throw new Error('Refresh token expiration is missing');
    await this.sessionsRepository.save(this.sessionsRepository.create({
      id: sessionId,
      userId: user.id,
      purpose: 'refresh',
      tokenHash: this.hashToken(tokens.refreshToken),
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(decoded.exp * 1000),
      revokedAt: null,
      consumedAt: null,
    }));
    return tokens;
  }

  private async createAndSendOtp(params: {
    email?: string | null;
    phone?: string | null;
    channel: 'email' | 'phone';
    purpose: string;
    subject: string;
    expiresInMinutes?: number;
  }): Promise<void> {
    if (params.channel === 'phone') {
      throw new HttpException(
        'Phone OTP delivery is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const normalizedEmail = params.email ? params.email.toLowerCase().trim() : null;
    const target = normalizedEmail || params.phone || '';

    const queryBuilder = this.otpRepository.createQueryBuilder('otp')
      .where('otp.purpose = :purpose', { purpose: params.purpose })
      .orderBy('otp.createdAt', 'DESC');

    if (normalizedEmail) {
      queryBuilder.andWhere('otp.email = :email', { email: normalizedEmail });
    } else if (params.phone) {
      queryBuilder.andWhere('otp.phone = :phone', { phone: params.phone });
    }

    const recentOtp = await queryBuilder.getOne();

    if (recentOtp && Date.now() - recentOtp.createdAt.getTime() < 60_000) {
      throw new HttpException(
        this.i18n.t('otp.wait_cooldown'),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100000, 1000000).toString();
    const expiryMinutes = params.expiresInMinutes ?? 5;

    // Invalidate previous unused codes
    if (normalizedEmail) {
      await this.otpRepository.update(
        { email: normalizedEmail, purpose: params.purpose, used: false },
        { used: true },
      );
    } else if (params.phone) {
      await this.otpRepository.update(
        { phone: params.phone, purpose: params.purpose, used: false },
        { used: true },
      );
    }

    const otp = this.otpRepository.create({
      email: normalizedEmail,
      phone: params.phone ?? null,
      channel: params.channel,
      purpose: params.purpose,
      codeHash: this.hashOtp(target, code),
      expiresAt: new Date(Date.now() + expiryMinutes * 60_000),
      attempts: 0,
      used: false,
    });

    await this.otpRepository.save(otp);

    if (params.channel === 'email' && normalizedEmail) {
      const from = this.configService.get<string>('RESEND_FROM_EMAIL');
      if (!from) {
        throw new Error('RESEND_FROM_EMAIL is missing from environment variables');
      }

      const isEn = this.i18n.getCurrentLanguage() === 'en';
      const emailHtml = isEn
        ? `
          <div dir="ltr" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b;">${params.subject}</h2>
            <p style="color: #475569;">Your verification code is:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 12px; text-align: center; border-radius: 6px;">
              ${code}
            </p>
            <p style="color: #64748b; font-size: 14px;">This code is valid for ${expiryMinutes} minutes. If expired, please request a new code. Do not share it with anyone.</p>
          </div>
        `
        : `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b;">${params.subject}</h2>
            <p style="color: #475569;">رمز التحقق الخاص بك هو:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 12px; text-align: center; border-radius: 6px;">
              ${code}
            </p>
            <p style="color: #64748b; font-size: 14px;">صلاحية هذا الرمز ${expiryMinutes} دقائق. عند انتهاء المهلة يلزم طلب رمز جديد. لا تشارك هذا الرمز مع أي شخص.</p>
          </div>
        `;

      try {
        const { error } = await this.resend.emails.send({
          from,
          to: normalizedEmail,
          subject: params.subject,
          html: emailHtml,
        });

        if (error) {
          otp.used = true;
          await this.otpRepository.save(otp);
          throw new HttpException(
            this.i18n.t('otp.delivery_failed'),
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
      } catch (err: unknown) {
        if (err instanceof HttpException) throw err;
        otp.used = true;
        await this.otpRepository.save(otp);
        throw new HttpException(
          this.i18n.t('otp.delivery_failed'),
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
  }

  private async verifyOtpRecord(params: {
    email?: string | null;
    phone?: string | null;
    purpose: string;
    code: string;
  }): Promise<EmailOtp> {
    const normalizedEmail = params.email ? params.email.toLowerCase().trim() : null;
    const target = normalizedEmail || params.phone || '';
    const result = await this.otpRepository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(EmailOtp);
      const queryBuilder = repo.createQueryBuilder('otp')
        .setLock('pessimistic_write')
        .where('otp.purpose = :purpose', { purpose: params.purpose })
        .andWhere('otp.used = :used', { used: false })
        .orderBy('otp.createdAt', 'DESC');
      if (normalizedEmail) queryBuilder.andWhere('otp.email = :email', { email: normalizedEmail });
      else if (params.phone) queryBuilder.andWhere('otp.phone = :phone', { phone: params.phone });

      const otp = await queryBuilder.getOne();
      if (!otp || otp.expiresAt.getTime() <= Date.now()) return { error: 'invalid' as const };
      if (otp.attempts >= 5) {
        otp.used = true;
        await repo.save(otp);
        return { error: 'attempts' as const };
      }
      if (!this.safeCompareHash(this.hashOtp(target, params.code), otp.codeHash)) {
        otp.attempts += 1;
        if (otp.attempts >= 5) otp.used = true;
        await repo.save(otp);
        return { error: 'invalid' as const };
      }
      otp.used = true;
      await repo.save(otp);
      return { otp };
    });

    if ('error' in result) {
      throw new BadRequestException(
        this.i18n.t(result.error === 'attempts' ? 'otp.too_many_attempts' : 'otp.invalid_or_expired'),
      );
    }
    return result.otp;
  }

  getLanguages(): { languages: LanguageInfo[]; defaultLanguage: SupportedLanguage } {
    return {
      languages: this.i18n.getSupportedLanguages(),
      defaultLanguage: 'ar',
    };
  }

  async setLanguage(
    userId?: string | null,
    language: SupportedLanguage = 'ar',
  ): Promise<{ message: string; language: SupportedLanguage; direction: 'rtl' | 'ltr' }> {
    if (userId) {
      await this.usersService.updateLanguage(userId, language);
    }

    return {
      message: this.i18n.t('language.updated', language),
      language,
      direction: language === 'ar' ? 'rtl' : 'ltr',
    };
  }

  async signup(dto: SignupDto): Promise<{
    message: string;
    accessToken?: string;
    refreshToken?: string;
    data: ReturnType<AuthService['sanitizeUser']>;
  }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (existingUser && existingUser.emailVerified) {
      throw new BadRequestException(this.i18n.t('auth.email_already_registered'));
    }

    const countryCode = dto.countryCode ?? dto.country_code;
    const acceptTerms = Boolean(
      dto.acceptTerms ?? dto.agreeToTerms ?? dto.accept_terms ?? dto.agree_to_terms ?? true,
    );
    this.validateE164Phone(countryCode, dto.phone);

    let emailVerified = false;
    if (dto.code) {
      await this.verifyOtpRecord({
        email: normalizedEmail,
        purpose: 'signup',
        code: dto.code,
      });
      emailVerified = true;
    }

    const passwordHash = await hash(dto.password, 10);
    let user: User;

    if (existingUser && !existingUser.emailVerified) {
      await this.usersService.setPassword(existingUser.id, passwordHash);
      await this.usersService.updateProfile(existingUser.id, {
        name: dto.name,
        phone: dto.phone,
        countryCode,
        acceptTerms,
      });
      user = (await this.usersService.findById(existingUser.id))!;
    } else {
      user = await this.usersService.createUserWithPassword(
        normalizedEmail,
        passwordHash,
        dto.name,
        dto.phone,
        countryCode,
        acceptTerms,
      );
    }

    if (emailVerified) {
      await this.usersService.markEmailVerified(user.id);
      user.emailVerified = true;
    } else {
      // Automatically request and send OTP directly to the user's email upon signup
      await this.createAndSendOtp({
        email: normalizedEmail,
        channel: 'email',
        purpose: 'signup',
        subject: this.i18n.t('otp.subject_signup'),
        expiresInMinutes: 5,
      });
    }

    const response = {
      message: emailVerified
        ? this.i18n.t('auth.signup_success')
        : this.i18n.t('otp.sent_email'),
      data: this.sanitizeUser(user),
    };
    if (!emailVerified) return response;
    const tokens = await this.issueSession(user);
    return { ...response, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async requestSignupOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await this.usersService.findByEmail(normalizedEmail);

    if (!existingUser) {
      throw new BadRequestException(this.i18n.t('auth.account_not_found_email'));
    }

    if (existingUser.emailVerified) {
      throw new BadRequestException(this.i18n.t('auth.email_already_registered'));
    }

    await this.createAndSendOtp({
      email: normalizedEmail,
      channel: 'email',
      purpose: 'signup',
      subject: this.i18n.t('otp.subject_signup'),
      expiresInMinutes: 5,
    });

    return {
      message: this.i18n.t('otp.sent_email'),
    };
  }

  async verifySignupOtp(email: string, code: string): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
    data: ReturnType<AuthService['sanitizeUser']>;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new BadRequestException(this.i18n.t('auth.account_not_found_email'));
    }

    await this.verifyOtpRecord({
      email: normalizedEmail,
      purpose: 'signup',
      code,
    });

    if (!user.emailVerified) {
      await this.usersService.markEmailVerified(user.id);
      user.emailVerified = true;
    }
    const tokens = await this.issueSession(user);

    return {
      message: this.i18n.t('auth.signup_email_verified'),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      data: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmailWithPassword(normalizedEmail);

    if (!user || !user.password) {
      throw new UnauthorizedException(this.i18n.t('auth.invalid_credentials'));
    }

    const isMatch = await compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException(this.i18n.t('auth.invalid_credentials'));
    }

    if (!user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.account_disabled'));
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(this.i18n.t('auth.email_not_verified'));
    }

    const tokens = await this.issueSession(user);

    return {
      message: this.i18n.t('auth.login_success'),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      data: this.sanitizeUser(user),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: string;
        tokenVersion: number;
        tokenType?: string;
        sid?: string;
        jti?: string;
      }>(refreshToken);

      if (payload.tokenType !== 'refresh' || !payload.sid || !payload.jti) {
        throw new UnauthorizedException(this.i18n.t('auth.invalid_token_type'));
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException(this.i18n.t('auth.session_revoked'));
      }

      const session = await this.sessionsRepository.findOne({
        where: {
          id: payload.sid,
          userId: user.id,
          purpose: 'refresh',
          tokenVersion: user.tokenVersion,
          tokenHash: this.hashToken(refreshToken),
          revokedAt: IsNull(),
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
      });
      if (!session) throw new UnauthorizedException(this.i18n.t('auth.invalid_token'));

      const refreshId = randomUUID();
      const tokens = await this.generateTokens(user, session.id, refreshId);
      const decoded = this.jwtService.decode(tokens.refreshToken) as { exp?: number } | null;
      if (!decoded?.exp) throw new UnauthorizedException(this.i18n.t('auth.invalid_token'));
      const rotation = await this.sessionsRepository.update(
        {
          id: session.id,
          tokenHash: session.tokenHash,
          revokedAt: IsNull(),
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        {
          tokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: new Date(decoded.exp * 1000),
        },
      );
      if (rotation.affected !== 1) throw new UnauthorizedException(this.i18n.t('auth.invalid_token'));

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        data: this.sanitizeUser(user),
      };
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.invalid_token'));
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (user) {
      try {
        await this.createAndSendOtp({
          email: normalizedEmail,
          channel: 'email',
          purpose: 'reset_password',
          subject: this.i18n.t('otp.subject_reset'),
          expiresInMinutes: 10,
        });
      } catch {
        // Keep the response indistinguishable for existing and unknown accounts.
      }
    }
    return { message: this.i18n.t('otp.reset_if_exists') };
  }

  async verifyResetPasswordOtp(dto: VerifyResetPasswordOtpDto): Promise<{
    message: string;
    resetToken: string;
    email: string;
  }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.account_not_found_email'));
    }

    await this.verifyOtpRecord({
      email: normalizedEmail,
      purpose: 'reset_password',
      code: dto.code,
    });

    const resetSessionId = randomUUID();
    const resetToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        purpose: 'reset_password',
        tokenVersion: user.tokenVersion,
        sid: resetSessionId,
      },
      { expiresIn: '15m' },
    );
    const decoded = this.jwtService.decode(resetToken) as { exp?: number } | null;
    if (!decoded?.exp) throw new Error('Reset token expiration is missing');
    await this.sessionsRepository.save(this.sessionsRepository.create({
      id: resetSessionId,
      userId: user.id,
      purpose: 'password_reset',
      tokenHash: this.hashToken(resetToken),
      tokenVersion: user.tokenVersion,
      expiresAt: new Date(decoded.exp * 1000),
      revokedAt: null,
      consumedAt: null,
    }));

    return {
      message: this.i18n.t('otp.code_valid'),
      resetToken,
      email: user.email,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
    data: ReturnType<AuthService['sanitizeUser']>;
  }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(this.i18n.t('auth.passwords_do_not_match'));
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.account_not_found_email'));
    }

    if (dto.resetToken) {
      let payload: {
        sid?: string;
        sub?: string;
        email?: string;
        purpose?: string;
        tokenVersion?: number;
      };
      try {
        payload = await this.jwtService.verifyAsync<{
          sub?: string;
          email?: string;
          purpose?: string;
          tokenVersion?: number;
          sid?: string;
        }>(dto.resetToken);

        if (
          payload.purpose !== 'reset_password' ||
          payload.sub !== user.id ||
          payload.email?.toLowerCase().trim() !== normalizedEmail ||
          payload.tokenVersion !== user.tokenVersion ||
          !payload.sid
        ) {
          throw new BadRequestException(this.i18n.t('auth.invalid_token'));
        }
      } catch {
        throw new BadRequestException(this.i18n.t('auth.invalid_token'));
      }

      const consumed = await this.sessionsRepository.update(
        {
          id: payload.sid,
          userId: user.id,
          purpose: 'password_reset',
          tokenHash: this.hashToken(dto.resetToken),
          tokenVersion: user.tokenVersion,
          revokedAt: IsNull(),
          consumedAt: IsNull(),
          expiresAt: MoreThan(new Date()),
        },
        { consumedAt: new Date() },
      );
      if (consumed.affected !== 1) throw new BadRequestException(this.i18n.t('auth.invalid_token'));
    } else if (dto.code) {
      await this.verifyOtpRecord({
        email: normalizedEmail,
        purpose: 'reset_password',
        code: dto.code,
      });
    } else {
      throw new BadRequestException(
        this.i18n.getCurrentLanguage() === 'ar'
          ? 'رمز التحقق أو التوكن مطلوب'
          : 'Verification code or reset token is required',
      );
    }

    const newPasswordHash = await hash(dto.newPassword, 10);
    await this.usersService.setPassword(user.id, newPasswordHash);
    await this.usersService.incrementTokenVersion(user.id);

    if (!user.emailVerified) {
      await this.usersService.markEmailVerified(user.id);
    }

    const updatedUser = (await this.usersService.findById(user.id))!;
    const tokens = await this.issueSession(updatedUser);

    return {
      message: this.i18n.t('auth.password_reset_success'),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      data: this.sanitizeUser(updatedUser),
    };
  }

  async requestChangePasswordOtp(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    await this.createAndSendOtp({
      email: user.email,
      channel: 'email',
      purpose: 'change_password',
      subject: this.i18n.t('otp.subject_change_password'),
      expiresInMinutes: 5,
    });

    return {
      message: this.i18n.t('otp.sent_email'),
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string; accessToken: string; refreshToken: string }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(this.i18n.t('auth.passwords_do_not_match'));
    }

    const user = await this.usersService.findByIdWithPassword(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    await this.verifyOtpRecord({
      email: user.email,
      purpose: 'change_password',
      code: dto.code,
    });

    if (dto.currentPassword && user.password) {
      const isMatch = await compare(dto.currentPassword, user.password);
      if (!isMatch) {
        throw new UnauthorizedException(this.i18n.t('auth.current_password_incorrect'));
      }
    }

    const newPasswordHash = await hash(dto.newPassword, 10);
    await this.usersService.setPassword(userId, newPasswordHash);
    await this.usersService.incrementTokenVersion(userId);

    const updatedUser = (await this.usersService.findById(userId))!;
    const tokens = await this.issueSession(updatedUser);

    return {
      message: this.i18n.t('auth.password_changed'),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async requestChangeEmailOtp(userId: string, newEmail: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    if (normalizedNewEmail === user.email.toLowerCase().trim()) {
      throw new BadRequestException(this.i18n.t('auth.email_same_as_current'));
    }

    const existingUser = await this.usersService.findByEmail(normalizedNewEmail);
    if (existingUser) {
      throw new ConflictException(this.i18n.t('auth.email_already_in_use'));
    }

    await this.createAndSendOtp({
      email: normalizedNewEmail,
      channel: 'email',
      purpose: 'change_email',
      subject: this.i18n.t('otp.subject_change_email'),
      expiresInMinutes: 5,
    });

    return {
      message: this.i18n.t('otp.sent_email'),
    };
  }

  async changeEmail(
    userId: string,
    dto: ChangeEmailDto,
  ): Promise<{ message: string; data: ReturnType<AuthService['sanitizeUser']> }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    const normalizedNewEmail = dto.newEmail.toLowerCase().trim();
    const existingUser = await this.usersService.findByEmail(normalizedNewEmail);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException(this.i18n.t('auth.email_already_in_use'));
    }

    await this.verifyOtpRecord({
      email: normalizedNewEmail,
      purpose: 'change_email',
      code: dto.code,
    });

    const updatedUser = await this.usersService.updateEmail(userId, normalizedNewEmail);

    return {
      message: this.i18n.t('auth.email_changed'),
      data: this.sanitizeUser(updatedUser),
    };
  }

  async requestDeleteAccountOtp(
    userId: string,
    channel: 'email' | 'phone' = 'email',
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    if (channel === 'phone') {
      if (!user.phone) {
        throw new BadRequestException(this.i18n.t('auth.no_phone_registered'));
      }
      await this.createAndSendOtp({
        phone: user.phone,
        email: user.email,
        channel: 'phone',
        purpose: 'delete_account',
        subject: this.i18n.t('otp.subject_delete_account'),
        expiresInMinutes: 5,
      });
      return {
        message: this.i18n.t('otp.sent_phone'),
      };
    }

    await this.createAndSendOtp({
      email: user.email,
      channel: 'email',
      purpose: 'delete_account',
      subject: this.i18n.t('otp.subject_delete_account'),
      expiresInMinutes: 5,
    });

    return {
      message: this.i18n.t('otp.sent_email'),
    };
  }

  async deleteAccount(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    await this.verifyOtpRecord({
      email: user.email,
      phone: user.phone,
      purpose: 'delete_account',
      code,
    });

    await this.otpRepository.delete({ email: user.email });
    await this.usersService.deleteUser(userId);

    return {
      message: this.i18n.t('auth.account_deleted'),
    };
  }

  async requestUpdatePhoneOtp(
    userId: string,
    countryCode: string,
    phone: string,
    channel: 'email' | 'phone' = 'email',
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    this.validateE164Phone(countryCode, phone);

    if (channel === 'phone') {
      await this.createAndSendOtp({
        phone: `${countryCode}${phone}`,
        channel: 'phone',
        purpose: 'update_phone',
        subject: this.i18n.t('otp.subject_update_phone'),
        expiresInMinutes: 5,
      });
      return {
        message: this.i18n.t('otp.sent_phone'),
      };
    }

    await this.createAndSendOtp({
      email: user.email,
      channel: 'email',
      purpose: 'update_phone',
      subject: this.i18n.t('otp.subject_update_phone'),
      expiresInMinutes: 5,
    });

    return {
      message: this.i18n.t('otp.sent_email'),
    };
  }

  async updatePhone(
    userId: string,
    dto: UpdatePhoneDto,
  ): Promise<{ message: string; data: ReturnType<AuthService['sanitizeUser']> }> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    const countryCode = (dto.countryCode ?? dto.country_code)!;
    this.validateE164Phone(countryCode, dto.phone);

    await this.verifyOtpRecord({
      email: user.email,
      phone: `${countryCode}${dto.phone}`,
      purpose: 'update_phone',
      code: dto.code,
    });

    const updatedUser = await this.usersService.updatePhone(
      userId,
      countryCode,
      dto.phone,
    );

    return {
      message: this.i18n.t('auth.phone_updated'),
      data: this.sanitizeUser(updatedUser),
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<{ message: string; data: ReturnType<AuthService['sanitizeUser']> }> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    const profileUrl = (dto.profileUrl ?? dto.profile_url)?.trim();
    const rawReadingLang = (dto.readingLanguage ?? dto.reading_language)?.trim();
    const readingLanguage = rawReadingLang
      ? this.i18n.resolveReadingLanguage(rawReadingLang)
      : undefined;

    let country: string | undefined = undefined;
    if (dto.country !== undefined) {
      const rawCountry = dto.country?.trim();
      if (!rawCountry) {
        country = null as any;
      } else {
        const resolvedCountry = this.i18n.resolveCountry(rawCountry);
        if (!resolvedCountry) {
          throw new BadRequestException(this.i18n.t('countries.not_found'));
        }
        country = resolvedCountry.id;
      }
    }

    const updatedUser = await this.usersService.updateProfile(userId, {
      name: dto.name,
      phone: dto.phone,
      birthday: dto.birthday,
      country,
      aboutMe: dto.aboutMe,
      profileUrl,
      readingLanguage,
    });

    return {
      message: this.i18n.t('auth.profile_updated'),
      data: this.sanitizeUser(updatedUser),
    };
  }

  async completeProfile(
    userId: string,
    dto: CompleteProfileDto,
  ): Promise<{ message: string; data: ReturnType<AuthService['sanitizeUser']> }> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    const rawReadingLang = (dto.readingLanguage ?? dto.reading_language)?.trim();
    const readingLanguage = this.i18n.resolveReadingLanguage(rawReadingLang);
    const profileUrl = (dto.profileUrl ?? dto.profile_url)?.trim();

    if (!profileUrl) {
      throw new BadRequestException(this.i18n.t('auth.profile_url_required'));
    }

    const rawCountry = dto.country?.trim();
    if (!rawCountry) {
      throw new BadRequestException(this.i18n.t('auth.country_required'));
    }
    const resolvedCountry = this.i18n.resolveCountry(rawCountry);
    if (!resolvedCountry) {
      throw new BadRequestException(this.i18n.t('countries.not_found'));
    }
    const country = resolvedCountry.id;

    const updatedUser = await this.usersService.updateProfile(userId, {
      profileUrl,
      birthday: dto.birthday,
      country,
      aboutMe: dto.aboutMe,
      readingLanguage,
      profileCompleted: true,
    });

    return {
      message: this.i18n.t('auth.profile_completed'),
      data: this.sanitizeUser(updatedUser),
    };
  }

  async requestOtp(email: string): Promise<void> {
    await this.createAndSendOtp({
      email,
      channel: 'email',
      purpose: 'login',
      subject: this.i18n.t('otp.subject_login'),
      expiresInMinutes: 5,
    });
  }

  async verifyOtp(email: string, code: string): Promise<AuthResponse> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.verifyOtpRecord({
      email: normalizedEmail,
      purpose: 'login',
      code,
    });

    let user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      user = await this.usersService.createUser(normalizedEmail);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.account_disabled'));
    }

    if (!user.emailVerified) {
      user = await this.usersService.markEmailVerified(user.id);
    }

    const tokens = await this.issueSession(user);

    return {
      message: this.i18n.t('auth.login_success'),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      data: this.sanitizeUser(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.user_not_found'));
    }

    return this.sanitizeUser(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.incrementTokenVersion(userId);
  }

  async googleLogin(idToken: string): Promise<AuthResponse> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    if (!clientId) {
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_ID is not configured',
      );
    }

    let payload;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });

      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(this.i18n.t('auth.google_invalid_token'));
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException(
        this.i18n.t('auth.google_email_not_verified'),
      );
    }

    const normalizedEmail = payload.email.toLowerCase().trim();

    let user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      user = await this.usersService.createGoogleUser(
        normalizedEmail,
        payload.name,
        payload.picture,
      );
    } else {
      const updates: { name?: string; profileUrl?: string } = {};
      if (!user.name && payload.name) updates.name = payload.name;
      if (!user.profileUrl && payload.picture) updates.profileUrl = payload.picture;
      if (Object.keys(updates).length > 0) {
        user = await this.usersService.updateProfile(user.id, updates);
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException(this.i18n.t('auth.account_disabled'));
    }

    if (!user.emailVerified) {
      user = await this.usersService.markEmailVerified(user.id);
    }

    const tokens = await this.issueSession(user);

    return {
      message: this.i18n.t('auth.google_login_success'),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      data: this.sanitizeUser(user),
    };
  }

  async resolveUserIdFromToken(token?: string): Promise<string | undefined> {
    if (!token) return undefined;
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      return payload?.sub;
    } catch {
      return undefined;
    }
  }
}
