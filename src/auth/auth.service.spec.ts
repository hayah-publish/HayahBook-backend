import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('AuthService session and privacy safeguards', () => {
  const user = {
    id: 'user-1',
    email: 'person@example.com',
    name: 'Person',
    phone: null,
    countryCode: null,
    profileUrl: null,
    birthday: null,
    country: null,
    aboutMe: null,
    role: 'user',
    emailVerified: true,
    profileCompleted: false,
    interestsSelected: false,
    authorsSelected: false,
    creatorsSelected: false,
    followersCount: 0,
    followingCount: 0,
    acceptTerms: true,
    language: 'ar',
    readingLanguage: null,
    userType: 'Reader',
    createdAt: new Date(),
    tokenVersion: 0,
    isActive: true,
  } as any;

  function createHarness() {
    const sessions = new Map<string, any>();
    const sessionsRepository = {
      create: (row: any) => row,
      save: jest.fn(async (row: any) => {
        sessions.set(row.id, { ...row });
        return row;
      }),
      findOne: jest.fn(async ({ where }: any) => {
        const row = sessions.get(where.id);
        if (!row || row.tokenHash !== where.tokenHash || row.revokedAt || row.consumedAt || row.expiresAt <= new Date()) return null;
        return { ...row };
      }),
      update: jest.fn(async (where: any, values: any) => {
        const row = sessions.get(where.id);
        if (!row || row.tokenHash !== where.tokenHash || row.revokedAt || row.consumedAt || row.expiresAt <= new Date()) return { affected: 0 };
        Object.assign(row, values);
        return { affected: 1 };
      }),
      createQueryBuilder: () => ({ delete: () => ({ where: () => ({ execute: async () => ({}) }) }) }),
    };
    const usersService = {
      findById: jest.fn(async () => ({ ...user })),
      findByEmail: jest.fn(async (_email: string) => null as any),
      createUserWithPassword: jest.fn(async () => ({ ...user, emailVerified: false })),
      markEmailVerified: jest.fn(async () => undefined),
    };
    const otpRepository = {};
    const jwtService = new JwtService({ secret: 'test-secret' });
    const config = { get: (key: string) => ({
      RESEND_API_KEY: 'test-key',
      JWT_SECRET: 'test-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '30d',
    } as Record<string, string>)[key] };
    const i18n = {
      t: (key: string) => key,
      formatCountry: (value: unknown) => value,
      formatReadingLanguage: (value: unknown) => value,
    };
    const service = new AuthService(
      otpRepository as any,
      sessionsRepository as any,
      usersService as any,
      jwtService,
      config as any,
      i18n as any,
      { enqueue: jest.fn() } as any,
    );
    return { service, sessionsRepository, sessions, usersService };
  }

  it('does not issue tokens for an unverified signup', async () => {
    const { service, usersService } = createHarness();
    jest.spyOn(service as any, 'createAndSendOtp').mockResolvedValue(undefined);

    const response = await service.signup({
      email: 'person@example.com', password: 'Password123!', name: 'Person',
    } as any);

    expect(response).not.toHaveProperty('accessToken');
    expect(response).not.toHaveProperty('refreshToken');
    expect(usersService.createUserWithPassword).toHaveBeenCalled();
  });

  it('returns the same forgot-password response for known and unknown accounts', async () => {
    const { service, usersService } = createHarness();
    jest.spyOn(service as any, 'createAndSendOtp').mockResolvedValue(undefined);
    usersService.findByEmail.mockImplementation(async (email: string) => email === user.email ? user : null);

    const known = await service.forgotPassword({ email: user.email } as any);
    const unknown = await service.forgotPassword({ email: 'missing@example.com' } as any);

    expect(known).toEqual(unknown);
    expect((service as any).createAndSendOtp).toHaveBeenCalledWith(expect.objectContaining({ delivery: 'outbox' }));
  });

  it('returns the same verification error for signup OTPs when the account is missing or the code is invalid', async () => {
    const { service, usersService } = createHarness();
    jest.spyOn(service as any, 'verifyOtpRecord').mockRejectedValue(new BadRequestException('otp.invalid_or_expired'));
    usersService.findByEmail.mockImplementation(async (email: string) => email === user.email ? user : null);

    const known = await service.verifySignupOtp(user.email, '000000').catch((error) => error.message);
    const unknown = await service.verifySignupOtp('missing@example.com', '000000').catch((error) => error.message);
    expect(known).toBe(unknown);
  });

  it('rotates a refresh token once and rejects both concurrent reuse and the old token afterward', async () => {
    const { service, sessionsRepository } = createHarness();
    const initial = await (service as any).issueSession(user);

    const results = await Promise.allSettled([
      service.refreshTokens(initial.refreshToken),
      service.refreshTokens(initial.refreshToken),
    ]);

    const successes = results.filter((result) => result.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const failures = results.filter((result) => result.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    await expect(service.refreshTokens(initial.refreshToken)).rejects.toBeDefined();
    expect(sessionsRepository.save).toHaveBeenCalledTimes(1);
  });

  it('rejects password reset tokens in JwtStrategy.validate', async () => {
    const { usersService } = createHarness();
    const strategy = new JwtStrategy(
      { get: () => 'test-secret' } as any,
      usersService as any,
      { t: (k: string) => k } as any,
    );

    await expect(
      strategy.validate({
        sub: user.id,
        role: 'user',
        tokenVersion: 0,
        purpose: 'reset_password',
        tokenType: 'password_reset',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('normalizes DD/MM/YYYY birthdays and rejects impossible calendar dates', () => {
    const { service } = createHarness();
    expect((service as any).normalizeBirthday('15/05/1995')).toBe('1995-05-15');
    expect(() => (service as any).normalizeBirthday('31/02/2000')).toThrow(
      BadRequestException,
    );
  });
});
