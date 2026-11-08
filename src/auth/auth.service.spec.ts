import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

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
      findByEmail: jest.fn(async () => null),
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
});
