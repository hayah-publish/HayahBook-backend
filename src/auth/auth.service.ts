
import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomInt } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailOtp } from './otp.entity';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly resend: Resend;

  constructor(
    @InjectRepository(EmailOtp)
    private readonly otpRepository: Repository<EmailOtp>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is missing from environment variables');
    }

    this.resend = new Resend(apiKey);
  }

  private hashOtp(email: string, code: string): string {
    return createHash('sha256')
      .update(`${email}:${code}`)
      .digest('hex');
  }

  async requestOtp(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    const recentOtp = await this.otpRepository.findOne({
      where: { email: normalizedEmail },
      order: { createdAt: 'DESC' },
    });

    if (
      recentOtp &&
      Date.now() - recentOtp.createdAt.getTime() < 60_000
    ) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = randomInt(100000, 1000000).toString();

    await this.otpRepository.update(
      { email: normalizedEmail, used: false },
      { used: true },
    );

    const otp = this.otpRepository.create({
      email: normalizedEmail,
      codeHash: this.hashOtp(normalizedEmail, code),
      expiresAt: new Date(Date.now() + 5 * 60_000),
      attempts: 0,
      used: false,
    });

    await this.otpRepository.save(otp);

    const from = this.configService.get<string>('RESEND_FROM_EMAIL');

    if (!from) {
      throw new Error('RESEND_FROM_EMAIL is missing from environment variables');
    }

    const { error } = await this.resend.emails.send({
      from,
      to: normalizedEmail,
      subject: 'رمز تسجيل الدخول - HayahBook',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2>رمز تسجيل الدخول</h2>
          <p>رمز التحقق الخاص بك هو:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">
            ${code}
          </p>
          <p>صلاحية الرمز 5 دقائق. لا تشاركه مع أي شخص.</p>
        </div>
      `,
    });

    if (error) {
      throw new Error(`Failed to send OTP email: ${error.message}`);
    }
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ accessToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const otp = await this.otpRepository.findOne({
      where: { email: normalizedEmail, used: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp || otp.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (otp.attempts >= 5) {
      throw new UnauthorizedException('Too many attempts');
    }

    const expectedHash = this.hashOtp(normalizedEmail, code);

    if (expectedHash !== otp.codeHash) {
      otp.attempts += 1;
      await this.otpRepository.save(otp);
      throw new UnauthorizedException('Invalid or expired code');
    }

    otp.used = true;
    await this.otpRepository.save(otp);

    let user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      user = await this.usersService.createUser(normalizedEmail);
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    if (!user.emailVerified) {
      user = await this.usersService.markEmailVerified(user.id);
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    return { accessToken };
  }
}
