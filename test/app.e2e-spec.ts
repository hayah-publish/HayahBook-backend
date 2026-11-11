import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { UsersService } from './../src/users/users.service';
import { User } from './../src/users/user.entity';
import { UserBook } from './../src/books/user-book.entity';
import { Book } from './../src/books/book.entity';
import { EmailOtp } from './../src/auth/otp.entity';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const createdTestUserIds = new Set<string>();

  beforeAll(async () => {
    const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
    const e2eDatabaseName = e2eDatabaseUrl
      ? new URL(e2eDatabaseUrl).pathname.toLowerCase()
      : '';
    if (!e2eDatabaseUrl || !/(test|e2e)/.test(e2eDatabaseName)) {
      throw new Error(
        'E2E_DATABASE_URL must point to a dedicated disposable database whose name includes test or e2e',
      );
    }
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = e2eDatabaseUrl;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: ['1', VERSION_NEUTRAL],
    });
    await app.init();

    const usersService = app.get(UsersService);
    for (const methodName of [
      'createUser',
      'createUserWithPassword',
    ] as const) {
      const original = usersService[methodName].bind(usersService);
      (usersService as any)[methodName] = async (...args: any[]) => {
        const user = await (original as (...a: any[]) => Promise<User>)(
          ...args,
        );
        createdTestUserIds.add(user.id);
        return user;
      };
    }
  });

  afterAll(async () => {
    if (!app) return;
    try {
      if (createdTestUserIds.size > 0) {
        const userRepo = app.get(getRepositoryToken(User));
        await userRepo.delete([...createdTestUserIds]);
      }
    } finally {
      await app.close();
    }
  });

  it('/ (GET) returns Hello World with version and platform headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Accept-Language', 'ar')
      .set('X-Platform', 'iOS')
      .set('X-App-Version', '1.0.0')
      .expect(200);

    expect(res.text).toBe('Hello World!');
    expect(res.headers['accept-language']).toBe('ar');
    expect(res.headers['x-platform']).toBe('iOS');
    expect(res.headers['x-app-version']).toBe('1.0.0');
  });

  describe('Step-by-Step Validation on POST /v1/auth/signup', () => {
    it('Step 1 (Name): empty body returns ONLY name required', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({})
        .expect(400);

      expect(res.body.message).toEqual(['الاسم مطلوب']);
    });

    it('Step 1b (Name min length): 1-char name returns ONLY name min length error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'د',
          email: 'user@example.com',
          phone: '0123456789',
          countryCode: '+20',
          password: 'Password123',
          acceptTerms: false,
        })
        .expect(400);

      expect(res.body.message).toEqual(['الاسم يجب ألا يقل عن حرفين']);
    });

    it('Step 1c (Name letters only): name with numbers returns letters-only error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد123',
          email: 'user@example.com',
          phone: '0123456789',
          countryCode: '+20',
          password: 'Password123',
          acceptTerms: false,
        })
        .expect(400);

      expect(res.body.message).toEqual([
        'الاسم يجب أن يحتوي على أحرف فقط (بدون أرقام أو رموز)',
      ]);
    });

    it('Step 1d (Name letters only): name with symbols returns letters-only error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'John@Doe',
          email: 'user@example.com',
          phone: '0123456789',
          countryCode: '+20',
          password: 'Password123',
          acceptTerms: false,
        })
        .expect(400);

      expect(res.body.message).toEqual([
        'الاسم يجب أن يحتوي على أحرف فقط (بدون أرقام أو رموز)',
      ]);
    });

    it('Step 2 (Email): name provided returns ONLY email required', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({ name: 'محمد خالد' })
        .expect(400);

      expect(res.body.message).toEqual(['البريد الإلكتروني مطلوب']);
    });

    it('Step 2b (Email format): invalid email returns ONLY invalid email message', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({ name: 'محمد خالد', email: 'invalid-email' })
        .expect(400);

      expect(res.body.message).toEqual(['البريد الإلكتروني غير صالح']);
    });

    it('Step 2c (Email min length): email under 6 chars returns ONLY min length error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({ name: 'محمد خالد', email: 'a@b.c' })
        .expect(400);

      expect(res.body.message).toEqual([
        'البريد الإلكتروني يجب ألا يقل عن 6 أحرف',
      ]);
    });

    it('Step 2d (Email 6 chars): 6-char email passes and moves to next step', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({ name: 'محمد خالد', email: 'a@b.co' })
        .expect(400);

      expect(res.body.message).toEqual(['كود الدولة مطلوب']);
    });

    it('Step 3 (Country Code): valid name & email returns ONLY country code required', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({ name: 'محمد خالد', email: 'valid.user@example.com' })
        .expect(400);

      expect(res.body.message).toEqual(['كود الدولة مطلوب']);
    });

    it('Step 4 (Phone): country code provided returns ONLY phone required', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: 'valid.user@example.com',
          countryCode: '+20',
        })
        .expect(400);

      expect(res.body.message).toEqual(['رقم الهاتف مطلوب']);
    });

    it('Step 4b (Phone country digits - Egypt): invalid phone for Egypt returns country-specific error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: 'valid.user@example.com',
          countryCode: '+20',
          phone: '12345',
        })
        .expect(400);

      expect(res.body.message).toEqual([
        'رقم الهاتف يجب أن يتكون من 10 أو 11 رقماً لكود الدولة +20 (مثال: 10XXXXXXXX أو 010XXXXXXXX)',
      ]);
    });

    it('Step 4c (Phone country digits - Saudi Arabia): invalid phone for Saudi Arabia returns country-specific error', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: 'valid.user@example.com',
          countryCode: '+966',
          phone: '12345',
        })
        .expect(400);

      expect(res.body.message).toEqual([
        'رقم الهاتف يجب أن يتكون من 9 أو 10 أرقام لكود الدولة +966 (مثال: 5XXXXXXXX أو 05XXXXXXXX)',
      ]);
    });

    it('Step 5 (Password): phone provided returns ONLY password required', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: 'valid.user@example.com',
          countryCode: '+20',
          phone: '01012345678',
        })
        .expect(400);

      expect(res.body.message).toEqual(['كلمة المرور مطلوبة']);
    });

    it('Step 5b (Password length): short password returns ONLY min length message', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: 'valid.user@example.com',
          countryCode: '+20',
          phone: '01012345678',
          password: 'short',
        })
        .expect(400);

      expect(res.body.message).toEqual(['كلمة المرور يجب ألا تقل عن 8 أحرف']);
    });

    it('Step 6 (Terms): valid password but acceptTerms false returns ONLY terms required', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: 'valid.user@example.com',
          countryCode: '+20',
          phone: '01012345678',
          password: 'Password123',
          acceptTerms: false,
        })
        .expect(400);

      expect(res.body.message).toEqual([
        'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية',
      ]);
    });

    it('English locale: empty body returns ONLY "Name is required"', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'en')
        .send({})
        .expect(400);

      expect(res.body.message).toEqual(['Name is required']);
    });
  });

  describe('Existing Email & emailVerified Check on OTP and Signup', () => {
    const nonExistentEmail = 'nonexistent-user-xyz@example.com';
    const verifiedEmail = 'verified-user@example.com';
    const unverifiedEmail = `unverified-user-${Date.now()}@example.com`;

    beforeAll(async () => {
      const usersService = app.get(UsersService);

      const existingVerified = await usersService.findByEmail(verifiedEmail);
      if (!existingVerified) {
        const user = await usersService.createUser(verifiedEmail);
        await usersService.markEmailVerified(user.id);
      } else if (!existingVerified.emailVerified) {
        await usersService.markEmailVerified(existingVerified.id);
      }

      const existingUnverified =
        await usersService.findByEmail(unverifiedEmail);
      if (!existingUnverified) {
        await usersService.createUser(unverifiedEmail);
      }
    });

    it('POST /v1/auth/otp/signup: email NOT in users does not send OTP and returns 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/signup')
        .set('Accept-Language', 'ar')
        .send({ email: nonExistentEmail })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'البريد الإلكتروني المُدخل غير مسجل، الحساب غير موجود',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/otp/signup: email NOT in users does not send OTP and returns 400 (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/signup')
        .set('Accept-Language', 'en')
        .send({ email: nonExistentEmail })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Account not found with this email',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/otp/signup: email exists & emailVerified is true does not send OTP and returns 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/signup')
        .set('Accept-Language', 'ar')
        .send({ email: verifiedEmail })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'البريد الإلكتروني مسجل بالفعل',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/otp/signup: email exists & emailVerified is true does not send OTP and returns 400 (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/signup')
        .set('Accept-Language', 'en')
        .send({ email: verifiedEmail })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Email already registered',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/otp/signup: email exists & emailVerified is false successfully sends OTP (200 OK)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/signup')
        .set('Accept-Language', 'ar')
        .send({ email: unverifiedEmail })
        .expect(200);

      expect(res.body).toEqual({
        message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح',
      });
    });

    it('POST /v1/auth/signup: with already verified email returns 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'ar')
        .send({
          name: 'محمد خالد',
          email: verifiedEmail,
          countryCode: '+20',
          phone: '01012345678',
          password: 'Password123',
          acceptTerms: true,
        })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'البريد الإلكتروني مسجل بالفعل',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/signup: with already verified email returns 400 (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/signup')
        .set('Accept-Language', 'en')
        .send({
          name: 'محمد خالد',
          email: verifiedEmail,
          countryCode: '+20',
          phone: '01012345678',
          password: 'Password123',
          acceptTerms: true,
        })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Email already registered',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/otp/verify-signup with invalid code returns 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify-signup')
        .set('Accept-Language', 'ar')
        .send({ email: unverifiedEmail, code: '000000' })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'رمز التحقق غير صحيح أو منتهي الصلاحية',
        error: 'Bad Request',
      });
    });

    it('POST /v1/auth/otp/verify-signup with invalid code returns 400 (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify-signup')
        .set('Accept-Language', 'en')
        .send({ email: unverifiedEmail, code: '000000' })
        .expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: 'Invalid or expired verification code',
        error: 'Bad Request',
      });
    });
  });

  describe('POST /v1/auth/login', () => {
    const verifiedLoginEmail = `verified-login-${Date.now()}@example.com`;
    const unverifiedLoginEmail = `unverified-login-${Date.now()}@example.com`;
    const password = 'Password123';

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(password, 10);

      // Verified user
      const verifiedUser = await usersService.createUserWithPassword(
        verifiedLoginEmail,
        passwordHash,
        'محمد خالد',
        '01012345678',
        '+20',
        true,
      );
      await usersService.markEmailVerified(verifiedUser.id);

      // Unverified user
      await usersService.createUserWithPassword(
        unverifiedLoginEmail,
        passwordHash,
        'علي أحمد',
        '01087654321',
        '+20',
        true,
      );
    });

    it('Login with invalid password returns 401 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Accept-Language', 'ar')
        .send({ email: verifiedLoginEmail, password: 'WrongPassword' })
        .expect(401);

      expect(res.body).toEqual({
        statusCode: 401,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
        error: 'Unauthorized',
      });
    });

    it('Login with invalid password returns 401 (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Accept-Language', 'en')
        .send({ email: verifiedLoginEmail, password: 'WrongPassword' })
        .expect(401);

      expect(res.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
    });

    it('Login with unverified email returns 403 Forbidden (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Accept-Language', 'ar')
        .send({ email: unverifiedLoginEmail, password })
        .expect(403);

      expect(res.body).toEqual({
        statusCode: 403,
        message: 'يرجى تأكيد البريد الإلكتروني أولاً',
        error: 'Forbidden',
      });
    });

    it('Login with unverified email returns 403 Forbidden (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Accept-Language', 'en')
        .send({ email: unverifiedLoginEmail, password })
        .expect(403);

      expect(res.body).toEqual({
        statusCode: 403,
        message: 'Please verify your email first',
        error: 'Forbidden',
      });
    });

    it('Login with verified email and correct password returns 200 OK (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Accept-Language', 'ar')
        .send({ email: verifiedLoginEmail, password })
        .expect(200);

      expect(res.body.message).toBe('تم تسجيل الدخول بنجاح');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.data.email).toBe(verifiedLoginEmail);
      expect(res.body.data.emailVerified).toBe(true);
      expect(res.body.data.readingLanguage).toBeNull();
    });

    it('Login with verified email and correct password returns 200 OK (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .set('Accept-Language', 'en')
        .send({ email: verifiedLoginEmail, password })
        .expect(200);

      expect(res.body.message).toBe('Logged in successfully');
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.data.email).toBe(verifiedLoginEmail);
      expect(res.body.data.emailVerified).toBe(true);
      expect(res.body.data.readingLanguage).toBeNull();
    });
  });

  describe('Reset Password Flow (e2e)', () => {
    const resetEmail = `reset-user-${Date.now()}@example.com`;
    const initialPassword = 'InitialPass123';
    const newPassword = 'NewSecret123';
    let resetCode: string;
    let resetToken: string;

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(initialPassword, 10);
      const user = await usersService.createUserWithPassword(
        resetEmail,
        passwordHash,
        'مستخدم ريسيت',
        '01011223344',
        '+20',
        true,
      );
      await usersService.markEmailVerified(user.id);

      // Seed an OTP record for reset_password
      const { ConfigService } = await import('@nestjs/config');
      const configService = app.get(ConfigService);
      const pepper =
        configService.get<string>('JWT_SECRET') ?? 'hayahbook_otp_pepper';
      const { createHash } = await import('crypto');
      resetCode = '123456';
      const codeHash = createHash('sha256')
        .update(`${pepper}:${resetEmail}:${resetCode}`)
        .digest('hex');

      const { getRepositoryToken } = await import('@nestjs/typeorm');
      const otpRepo = app.get(getRepositoryToken(EmailOtp));
      await otpRepo.save({
        email: resetEmail,
        channel: 'email',
        purpose: 'reset_password',
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60_000),
        attempts: 0,
        used: false,
      });
    });

    it('Step 1 (Screen 1): verify reset OTP with invalid code returns 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify-reset-password')
        .set('Accept-Language', 'ar')
        .send({ email: resetEmail, code: '999999' })
        .expect(400);

      expect(res.body.message).toBe('رمز التحقق غير صحيح أو منتهي الصلاحية');
    });

    it('Step 1 (Screen 1): verify reset OTP with valid code returns 200 and resetToken (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/otp/verify-reset-password')
        .set('Accept-Language', 'ar')
        .send({ email: resetEmail, code: resetCode })
        .expect(200);

      expect(res.body.message).toBe('رمز التحقق صحيح');
      expect(res.body.resetToken).toBeDefined();
      expect(res.body.email).toBe(resetEmail);
      resetToken = res.body.resetToken;
    });

    it('Step 2 (Screen 2): reset password with passwords mismatch returns 400 (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .set('Accept-Language', 'ar')
        .send({
          email: resetEmail,
          resetToken,
          newPassword,
          confirmPassword: 'MismatchPassword123',
        })
        .expect(400);

      expect(res.body.message).toBe(
        'كلمة المرور وتأكيد كلمة المرور غير متطابقين',
      );
    });

    it('Step 2 (Screen 2): reset password with resetToken succeeds and updates password', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/reset-password')
        .set('Accept-Language', 'ar')
        .send({
          email: resetEmail,
          resetToken,
          newPassword,
          confirmPassword: newPassword,
        })
        .expect(200);

      expect(res.body.message).toBe(
        'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
      );
      expect(res.body.accessToken).toBeDefined();

      // Verify can now login with new password
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: resetEmail, password: newPassword })
        .expect(200);
    });
  });

  describe('Interests (e2e)', () => {
    let authToken: string;
    const testEmail = `interest-user-${Date.now()}@example.com`;
    const testPassword = 'Password123';
    let allInterests: Array<{
      id: string;
      displayName: string;
      name_ar: string;
      name_en: string;
      category: string;
      category_ar: string;
      category_en: string;
    }>;

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(testPassword, 10);
      const user = await usersService.createUserWithPassword(
        testEmail,
        passwordHash,
        'مستخدم الاهتمامات',
        '01099887766',
        '+20',
        true,
      );
      await usersService.markEmailVerified(user.id);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      authToken = loginRes.body.accessToken;
    });

    it('GET /v1/interests returns all 63 interests with Arabic display (ar)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/interests')
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(63);
      allInterests = res.body;

      const first = res.body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('displayName');
      expect(first).toHaveProperty('name_ar');
      expect(first).toHaveProperty('name_en');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('category_ar');
      expect(first).toHaveProperty('category_en');
      expect(first.displayName).toBe(first.name_ar);
      expect(first.category).toBe(first.category_ar);
    });

    it('GET /v1/interests returns English display with Accept-Language: en', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/interests')
        .set('Accept-Language', 'en')
        .expect(200);

      expect(res.body.length).toBe(63);
      const first = res.body[0];
      expect(first.displayName).toBe(first.name_en);
      expect(first.category).toBe(first.category_en);
    });

    it('GET /v1/categories/articles returns the 9 article categories matching attached designs', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/categories/articles')
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(9);
      const namesAr = res.body.map((c: any) => c.name_ar);
      expect(namesAr).toContain('احداث حالية');
      expect(namesAr).toContain('تاريخ وتراث');
      expect(namesAr).toContain('ثقافة وفنون');
      expect(namesAr).toContain('معرفة وتعليم');
      expect(namesAr).toContain('أعمال ومهارات');
      expect(namesAr).toContain('تطوير الذات');
      expect(namesAr).toContain('مجتمع وحياة');
      expect(namesAr).toContain('مقالات حرة');
      expect(namesAr).toContain('سفر وأماكن');

      const first = res.body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('displayName');
      expect(first).toHaveProperty('name_ar');
      expect(first).toHaveProperty('name_en');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('category_ar');
      expect(first).toHaveProperty('category_en');
      expect(first.category_ar).toBe('المقالات');
      expect(first.category_en).toBe('Articles');
    });

    it('GET /v1/categories/articles returns English names when Accept-Language is en', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/categories/articles')
        .set('Accept-Language', 'en')
        .expect(200);

      expect(res.body.length).toBe(9);
      const namesEn = res.body.map((c: any) => c.name_en);
      expect(namesEn).toContain('Current events');
      expect(namesEn).toContain('History and heritage');
      expect(namesEn).toContain('Culture and arts');
      expect(namesEn).toContain('Knowledge and education');
      expect(namesEn).toContain('Business and skills');
      expect(namesEn).toContain('Self development');
      expect(namesEn).toContain('Society and life');
      expect(namesEn).toContain('Free articles');
      expect(namesEn).toContain('Travel and places');
      expect(res.body[0].category).toBe('Articles');
    });

    it('GET /v1/interests?category=articles returns the 9 article categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/interests?category=articles')
        .expect(200);

      expect(res.body.length).toBe(9);
      expect(res.body[0].category_en).toBe('Articles');
    });

    it('GET /v1/articles/categories returns specifically the 9 article categories in sorted order', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/articles/categories')
        .set('Accept-Language', 'en')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(9);
      expect(res.body[0].displayName).toBe('Current events');
      expect(res.body[0].name_ar).toBe('احداث حالية');
      expect(res.body[0].name_en).toBe('Current events');
      expect(res.body[8].displayName).toBe('Travel and places');
    });

    it('POST /v1/interests/me fails if < 3 selected from Books section', async () => {
      const books = allInterests
        .filter((i) => i.category_ar === 'الكتب')
        .slice(0, 2);
      const visuals = allInterests
        .filter((i) => i.category_ar === 'المرئيات')
        .slice(0, 3);
      const articles = allInterests
        .filter((i) => i.category_ar === 'المقالات')
        .slice(0, 3);
      const snippets = allInterests
        .filter((i) => i.category_ar === 'المقتطفات')
        .slice(0, 3);

      const res = await request(app.getHttpServer())
        .post('/v1/interests/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          interestIds: [...books, ...visuals, ...articles, ...snippets].map(
            (i) => i.id,
          ),
        })
        .expect(400);

      expect(res.body.message).toBe(
        'يجب اختيار 3 اهتمامات على الأقل من قسم الكتب',
      );
    });

    it('POST /v1/interests/me fails if < 3 selected from Visuals section (en)', async () => {
      const books = allInterests
        .filter((i) => i.category_ar === 'الكتب')
        .slice(0, 3);
      const visuals = allInterests
        .filter((i) => i.category_ar === 'المرئيات')
        .slice(0, 2);
      const articles = allInterests
        .filter((i) => i.category_ar === 'المقالات')
        .slice(0, 3);
      const snippets = allInterests
        .filter((i) => i.category_ar === 'المقتطفات')
        .slice(0, 3);

      const res = await request(app.getHttpServer())
        .post('/v1/interests/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({
          interestIds: [...books, ...visuals, ...articles, ...snippets].map(
            (i) => i.id,
          ),
        })
        .expect(400);

      expect(res.body.message).toBe(
        'You must select at least 3 interests from Visuals section',
      );
    });

    it('POST /v1/interests/me succeeds when 3 or more selected from each of the 4 sections', async () => {
      const books = allInterests
        .filter((i) => i.category_ar === 'الكتب')
        .slice(0, 3);
      const visuals = allInterests
        .filter((i) => i.category_ar === 'المرئيات')
        .slice(0, 3);
      const articles = allInterests
        .filter((i) => i.category_ar === 'المقالات')
        .slice(0, 3);
      const snippets = allInterests
        .filter((i) => i.category_ar === 'المقتطفات')
        .slice(0, 3);

      const res = await request(app.getHttpServer())
        .post('/v1/interests/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          interestIds: [...books, ...visuals, ...articles, ...snippets].map(
            (i) => i.id,
          ),
        })
        .expect(200);

      expect(res.body.interestsCount).toBe(12);
      expect(res.body.categories).toEqual({
        books: 3,
        visuals: 3,
        articles: 3,
        snippets: 3,
      });
    });

    it('POST /v1/interests/me allows adding 1 or 2 interests later once user already selected interests before', async () => {
      // Pick a 4th book interest that was not in the initial 12
      const fourthBook = allInterests.filter(
        (i) => i.category_ar === 'الكتب',
      )[3];

      const res = await request(app.getHttpServer())
        .post('/v1/interests/me')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({ interestIds: [fourthBook.id] })
        .expect(200);

      // Now user has 13 interests (12 previous + 1 added)
      expect(res.body.interestsCount).toBe(13);
      expect(res.body.categories.books).toBe(4);
    });

    it('DELETE /v1/interests/me/:interestId removes an interest from user interests', async () => {
      const fourthBook = allInterests.filter(
        (i) => i.category_ar === 'الكتب',
      )[3];

      const res = await request(app.getHttpServer())
        .delete(`/v1/interests/me/${fourthBook.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.interestsCount).toBe(12);
    });
  });

  describe('Countries (e2e)', () => {
    it('GET /v1/countries returns list with Arabic display (ar)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/countries')
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(245);

      const egypt = res.body.find(
        (c: { name_en: string }) => c.name_en === 'Egypt',
      );
      expect(egypt).toBeDefined();
      expect(egypt.id).toBeDefined();
      expect(egypt.displayName).toBe('مصر');
      expect(egypt.name_ar).toBe('مصر');
      expect(egypt.name_en).toBe('Egypt');
      expect(egypt.flagUrl).toBe('https://flagcdn.com/w80/eg.png');
      expect(egypt.code).toBeUndefined();
      expect(egypt.flag).toBeUndefined();
      expect(egypt.phoneCode).toBeUndefined();
    });

    it('GET /v1/countries returns English display with Accept-Language: en', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/countries')
        .set('Accept-Language', 'en')
        .expect(200);

      const egypt = res.body.find(
        (c: { name_en: string }) => c.name_en === 'Egypt',
      );
      expect(egypt.displayName).toBe('Egypt');
    });

    it('GET /v1/countries?search=مصر filters countries', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/countries?search=مصر')
        .expect(200);

      expect(res.body.length).toBe(1);
      expect(res.body[0].name_en).toBe('Egypt');
    });

    it('GET /v1/auth/countries returns the same countries list', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/auth/countries')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(245);
    });
  });

  describe('Authors and Following (e2e)', () => {
    const testEmail = `authors-test-${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    let authToken: string;
    let seededAuthors: Array<{
      id: string;
      name: string;
      userType: string;
      userTypeLabel: string;
      profileUrl: string | null;
      aboutMe: string | null;
      country: string | null;
      role: string;
      isVerified: boolean;
      followersCount: number;
      isFollowing: boolean;
    }>;

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(testPassword, 10);
      const user = await usersService.createUserWithPassword(
        testEmail,
        passwordHash,
        'مستخدم المؤلفين',
        '01011223344',
        '+20',
        true,
      );
      await usersService.markEmailVerified(user.id);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      authToken = loginRes.body.accessToken;
    });

    it('GET /v1/authors returns seeded authors list sorted by followersCount (up to 50)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/authors')
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(50);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
      seededAuthors = res.body;

      const first = res.body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('userType');
      expect(first).toHaveProperty('userTypeLabel');
      expect(first).toHaveProperty('profileUrl');
      expect(first).toHaveProperty('aboutMe');
      expect(first).toHaveProperty('country');
      expect(first).toHaveProperty('role');
      expect(first).toHaveProperty('isVerified');
      expect(first).toHaveProperty('followersCount');
      expect(first).toHaveProperty('isFollowing');
      expect(first.isFollowing).toBe(false);
    });

    it('POST /v1/authors/follow/batch fails if fewer than 5 authors on initial follow (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/authors/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          authorIds: [
            seededAuthors[0].id,
            seededAuthors[1].id,
            seededAuthors[2].id,
            seededAuthors[3].id,
          ],
        })
        .expect(400);

      expect(res.body.message).toBe('اختر (5) على الأقل للمتابعة');
    });

    it('POST /v1/authors/follow/batch fails if fewer than 5 authors on initial follow (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/authors/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({ authorIds: [seededAuthors[0].id] })
        .expect(400);

      expect(res.body.message).toBe(
        'Please select at least 5 authors to follow',
      );
    });

    it('POST /v1/authors/follow/batch succeeds when selecting 5 authors and sets authorsSelected = true', async () => {
      const selectedIds = [
        seededAuthors[0].id,
        seededAuthors[1].id,
        seededAuthors[2].id,
        seededAuthors[3].id,
        seededAuthors[4].id,
      ];

      const res = await request(app.getHttpServer())
        .post('/v1/authors/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({ authorIds: selectedIds })
        .expect(200);

      expect(res.body.followingCount).toBe(5);
      expect(res.body.authorsSelected).toBe(true);
      expect(res.body.message).toBe('تمت متابعة المؤلفين بنجاح');
    });

    it('POST /v1/authors/follow/batch allows adding 1 author once initial 5 followed', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/authors/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({ authorIds: [seededAuthors[5].id] })
        .expect(200);

      expect(res.body.followingCount).toBe(6);
      expect(res.body.authorsSelected).toBe(true);
    });

    it('GET /v1/authors/following returns the 6 followed authors', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/authors/following')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(6);
      expect(res.body.every((a: any) => a.isFollowing === true)).toBe(true);
    });

    it('POST /v1/authors/:id/toggle-follow un-follows a followed author', async () => {
      const targetId = seededAuthors[0].id;
      const res = await request(app.getHttpServer())
        .post(`/v1/authors/${targetId}/toggle-follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(false);
      expect(res.body.message).toBe('تم إلغاء المتابعة بنجاح');
    });

    it('POST /v1/authors/:id/toggle-follow re-follows the author', async () => {
      const targetId = seededAuthors[0].id;
      const res = await request(app.getHttpServer())
        .post(`/v1/authors/${targetId}/toggle-follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(true);
      expect(res.body.message).toBe('تمت المتابعة بنجاح');
    });

    it('GET /v1/authors/:id returns single author with isFollowing=true', async () => {
      const targetId = seededAuthors[0].id;
      const res = await request(app.getHttpServer())
        .get(`/v1/authors/${targetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(targetId);
      expect(res.body.isFollowing).toBe(true);
    });

    it('GET /v1/authors/suggested returns recommendations ordered by shared interests + followersCount (max 50)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/authors/suggested')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(50);
      expect(res.body[0]).toHaveProperty('matchingInterests');
      expect(res.body[0]).toHaveProperty('followersCount');

      // Verify sorting:
      // For any two authors i and i+1:
      // either matchingInterests.length > next.matchingInterests.length
      // or (if matchCount is equal) followersCount >= next.followersCount
      for (let i = 0; i < res.body.length - 1; i++) {
        const current = res.body[i];
        const next = res.body[i + 1];
        const currentMatch = current.matchingInterests.length;
        const nextMatch = next.matchingInterests.length;

        if (currentMatch !== nextMatch) {
          expect(currentMatch).toBeGreaterThan(nextMatch);
        } else {
          expect(current.followersCount).toBeGreaterThanOrEqual(
            next.followersCount,
          );
        }
      }
    });
  });

  describe('Content Creators and Following (e2e)', () => {
    const testEmail = `creators-test-${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    let authToken: string;
    let seededCreators: Array<{
      id: string;
      name: string;
      userType: string;
      userTypeLabel: string;
      profileUrl: string | null;
      aboutMe: string | null;
      country: string | null;
      role: string;
      isVerified: boolean;
      followersCount: number;
      isFollowing: boolean;
    }>;

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(testPassword, 10);
      const user = await usersService.createUserWithPassword(
        testEmail,
        passwordHash,
        'مستخدم صناع المحتوى',
        '01099887766',
        '+20',
        true,
      );
      await usersService.markEmailVerified(user.id);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      authToken = loginRes.body.accessToken;
    });

    it('GET /v1/creators returns seeded creators list sorted by followersCount (up to 50)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/creators')
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(50);
      expect(res.body.length).toBeGreaterThanOrEqual(10);
      seededCreators = res.body;

      const first = res.body[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('userType');
      expect(first).toHaveProperty('userTypeLabel');
      expect(first.userTypeLabel).toBe('صانع محتوى');
      expect(first).toHaveProperty('profileUrl');
      expect(first).toHaveProperty('aboutMe');
      expect(first).toHaveProperty('country');
      expect(first).toHaveProperty('role');
      expect(first).toHaveProperty('isVerified');
      expect(first).toHaveProperty('followersCount');
      expect(first).toHaveProperty('isFollowing');
      expect(first.isFollowing).toBe(false);
    });

    it('POST /v1/creators/follow/batch fails if fewer than 5 creators on initial follow (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/creators/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          creatorIds: [
            seededCreators[0].id,
            seededCreators[1].id,
            seededCreators[2].id,
            seededCreators[3].id,
          ],
        })
        .expect(400);

      expect(res.body.message).toBe('اختر (5) على الأقل للمتابعة');
    });

    it('POST /v1/creators/follow/batch fails if fewer than 5 creators on initial follow (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/creators/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({ creatorIds: [seededCreators[0].id] })
        .expect(400);

      expect(res.body.message).toBe(
        'Please select at least 5 creators to follow',
      );
    });

    it('POST /v1/creators/follow/batch succeeds when selecting 5 creators and sets creatorsSelected = true', async () => {
      const selectedIds = [
        seededCreators[0].id,
        seededCreators[1].id,
        seededCreators[2].id,
        seededCreators[3].id,
        seededCreators[4].id,
      ];

      const res = await request(app.getHttpServer())
        .post('/v1/creators/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({ creatorIds: selectedIds })
        .expect(200);

      expect(res.body.followingCount).toBe(5);
      expect(res.body.creatorsSelected).toBe(true);
      expect(res.body.message).toBe('تمت متابعة صناع المحتوى بنجاح');
    });

    it('POST /v1/creators/follow/batch allows adding 1 creator once initial 5 followed', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/creators/follow/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({ creatorIds: [seededCreators[5].id] })
        .expect(200);

      expect(res.body.followingCount).toBe(6);
      expect(res.body.creatorsSelected).toBe(true);
    });

    it('GET /v1/creators/following returns the 6 followed creators', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/creators/following')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(6);
      expect(res.body.every((c: any) => c.isFollowing === true)).toBe(true);
    });

    it('POST /v1/creators/:id/toggle-follow un-follows a followed creator', async () => {
      const targetId = seededCreators[0].id;
      const res = await request(app.getHttpServer())
        .post(`/v1/creators/${targetId}/toggle-follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(false);
      expect(res.body.message).toBe('تم إلغاء المتابعة بنجاح');
    });

    it('POST /v1/creators/:id/toggle-follow re-follows the creator', async () => {
      const targetId = seededCreators[0].id;
      const res = await request(app.getHttpServer())
        .post(`/v1/creators/${targetId}/toggle-follow`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(true);
      expect(res.body.message).toBe('تمت المتابعة بنجاح');
    });

    it('GET /v1/creators/:id returns single creator with isFollowing=true', async () => {
      const targetId = seededCreators[0].id;
      const res = await request(app.getHttpServer())
        .get(`/v1/creators/${targetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.id).toBe(targetId);
      expect(res.body.isFollowing).toBe(true);
    });

    it('GET /v1/creators/suggested returns recommendations ordered by shared interests + followersCount (max 50)', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/creators/suggested')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(50);
      expect(res.body[0]).toHaveProperty('matchingInterests');
      expect(res.body[0]).toHaveProperty('followersCount');

      for (let i = 0; i < res.body.length - 1; i++) {
        const current = res.body[i];
        const next = res.body[i + 1];
        const currentMatch = current.matchingInterests.length;
        const nextMatch = next.matchingInterests.length;

        if (currentMatch !== nextMatch) {
          expect(currentMatch).toBeGreaterThan(nextMatch);
        } else {
          expect(current.followersCount).toBeGreaterThanOrEqual(
            next.followersCount,
          );
        }
      }
    });
  });

  describe('User-to-User Following (e2e)', () => {
    const userAEmail = `user-a-${Date.now()}@example.com`;
    const userBEmail = `user-b-${Date.now()}@example.com`;
    const password = 'Password123!';
    let tokenA: string;
    let userAId: string;
    let userBId: string;

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(password, 10);

      const userA = await usersService.createUserWithPassword(
        userAEmail,
        passwordHash,
        'المستخدم الأول',
        '01011110001',
        '+20',
        true,
      );
      userAId = userA.id;
      await usersService.markEmailVerified(userA.id);

      const userB = await usersService.createUserWithPassword(
        userBEmail,
        passwordHash,
        'المستخدم الثاني',
        '01011110002',
        '+20',
        true,
      );
      userBId = userB.id;
      await usersService.markEmailVerified(userB.id);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: userAEmail, password });
      tokenA = loginRes.body.accessToken;
    });

    it('POST /v1/users/:id/follow fails when trying to follow oneself (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/users/${userAId}/follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Accept-Language', 'ar')
        .expect(400);

      expect(res.body.message).toBe('لا يمكنك متابعة حسابك الشخصي');
    });

    it('POST /v1/users/:id/follow succeeds when following another regular user', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/users/${userBId}/follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(true);
      expect(res.body.followersCount).toBe(1);
      expect(res.body.message).toBe('تمت متابعة المستخدم بنجاح');
    });

    it('GET /v1/users/me/following returns userB in following list', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users/me/following')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(userBId);
      expect(res.body[0].isFollowing).toBe(true);
    });

    it('GET /v1/users/:id/followers returns userA as follower of userB', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${userBId}/followers`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(userAId);
    });

    it('GET /v1/users/:id returns public profile with counts and isFollowing', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/users/${userBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.id).toBe(userBId);
      expect(res.body.followersCount).toBe(1);
      expect(res.body.isFollowing).toBe(true);
    });

    it('POST /v1/users/:id/toggle-follow un-follows the user', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/users/${userBId}/toggle-follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(false);
      expect(res.body.followersCount).toBe(0);
      expect(res.body.message).toBe('تم إلغاء متابعة المستخدم بنجاح');
    });

    it('POST /v1/users/:id/toggle-follow re-follows the user', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/users/${userBId}/toggle-follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(true);
      expect(res.body.followersCount).toBe(1);
    });

    it('DELETE /v1/users/:id/follow explicitly unfollows the user', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/users/${userBId}/follow`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.isFollowing).toBe(false);
      expect(res.body.followersCount).toBe(0);
    });
  });

  describe('Cloudflare R2 Profile Photo Upload (e2e)', () => {
    let authToken: string;

    beforeAll(async () => {
      const usersService = app.get(UsersService);
      const testEmail = `upload-user-${Date.now()}@example.com`;
      const testPassword = 'Password123!';
      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(testPassword, 10);
      const user = await usersService.createUserWithPassword(
        testEmail,
        passwordHash,
        'مستخدم الرفع',
        '01055556666',
        '+20',
        true,
      );
      await usersService.markEmailVerified(user.id);

      const loginRes = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: testEmail, password: testPassword });
      authToken = loginRes.body.accessToken;
    });

    it('POST /v1/upload/avatar fails with 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).post('/v1/upload/avatar').expect(401);
    });

    it('POST /v1/upload/avatar fails with 400 when no file is uploaded (ar)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(400);

      expect(res.body.message).toBe('يرجى اختيار صورة');
    });

    it('POST /v1/upload/avatar fails with 400 for unsupported file type (en)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .attach('file', Buffer.from('plain text'), {
          filename: 'doc.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      expect(res.body.message).toBe(
        'Unsupported file type. Allowed types: JPG, PNG, WEBP, HEIC',
      );
    });

    it('POST /v1/upload/avatar rejects animated GIF and non-mobile image formats (ar)', async () => {
      const fakeGifBuffer = Buffer.from('GIF89a...');

      const res = await request(app.getHttpServer())
        .post('/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .attach('file', fakeGifBuffer, {
          filename: 'avatar.gif',
          contentType: 'image/gif',
        })
        .expect(400);

      expect(res.body.message).toBe(
        'نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP, HEIC',
      );
    });

    it('POST /v1/upload/avatar returns 413 with localized Arabic message when file exceeds Multer limit (ar)', async () => {
      // 10MB limit in avatar upload; create buffer slightly exceeding 10MB
      const hugeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);

      const res = await request(app.getHttpServer())
        .post('/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .attach('file', hugeBuffer, {
          filename: 'huge_avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(413);

      expect(res.body.statusCode).toBe(413);
      expect(res.body.message).toBe('حجم الملف يتجاوز الحد الأقصى المسموح به');
      expect(res.body.error).toBe('Payload Too Large');
    });

    it('POST /v1/upload/avatar returns 413 with English message when file exceeds Multer limit (en)', async () => {
      const hugeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024);

      const res = await request(app.getHttpServer())
        .post('/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .attach('file', hugeBuffer, {
          filename: 'huge_avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(413);

      expect(res.body.statusCode).toBe(413);
      expect(res.body.message).toBe('File too large');
      expect(res.body.error).toBe('Payload Too Large');
    });

    it('POST /v1/upload/avatar successfully uploads JPG image to Cloudflare R2', async () => {
      const fakeJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);

      const res = await request(app.getHttpServer())
        .post('/v1/upload/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .attach('file', fakeJpegBuffer, {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(200);

      expect(res.body.message).toBe('تم رفع الصورة الشخصية بنجاح');
      expect(res.body.profileUrl).toContain(
        'https://cdn.hayahbook.com/avatars/',
      );
      expect(res.body.profileUrl).toContain('.jpg');
    });

    it('POST /v1/auth/avatar alias endpoint also uploads and updates profile successfully', async () => {
      const fakePngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);

      const res = await request(app.getHttpServer())
        .post('/v1/auth/avatar')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .attach('file', fakePngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(200);

      expect(res.body.message).toBe('Profile photo uploaded successfully');
      expect(res.body.profileUrl).toContain(
        'https://cdn.hayahbook.com/avatars/',
      );
      expect(res.body.profileUrl).toContain('.png');
    });
  });

  describe('User Reading List & Books Tracker (e2e)', () => {
    let authToken: string;
    let testBookId: string;

    beforeAll(async () => {
      const jwtService = app.get(JwtService);
      const usersService = app.get(UsersService);
      const user = await usersService.findByEmail(
        'hussein.mohamed.software@gmail.com',
      );
      authToken = jwtService.sign({
        sub: user!.id,
        role: user!.role,
        tokenVersion: user!.tokenVersion,
      });

      const userBookRepo = app.get(getRepositoryToken(UserBook));
      const bookRepo = app.get(getRepositoryToken(Book));
      const existingCount = await userBookRepo.count({
        where: { userId: user!.id },
      });
      if (existingCount < 3) {
        const books = await bookRepo.find({ take: 5 });
        for (let i = 0; i < books.length; i++) {
          const status =
            i === 0 ? 'reading' : i === 1 ? 'finished' : 'want_to_read';
          await userBookRepo.save({
            userId: user!.id,
            bookId: books[i].id,
            status,
            progress: i === 1 ? 100 : 35,
            rating: 4.5,
          });
        }
      }
    });

    it('GET /v1/books/my-books fails with 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/v1/books/my-books').expect(401);
    });

    it('GET /v1/books/my-books returns authenticated user reading list with type and format flags', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/books/my-books')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      const first = res.body.data[0];
      testBookId = first.bookId || first.id;
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('author');
      expect(first).toHaveProperty('status');
      expect(first).toHaveProperty('progress');
      expect(first).toHaveProperty('type');
      expect(['ebook', 'audiobook', 'both']).toContain(first.type);
      expect(first).toHaveProperty('hasEbook');
      expect(first).toHaveProperty('hasAudio');
      expect(first).toHaveProperty('availableFormats');
      expect(Array.isArray(first.availableFormats)).toBe(true);
    });

    it('GET /v1/books/my-books?status=finished filters only finished books for "Books I finished" screen', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/books/my-books?status=finished')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      for (const item of res.body.data) {
        expect(item.status).toBe('finished');
        expect(item.progress).toBe(100);
      }

      // Check that items supporting both formats have type === 'both' and both flags true
      const bothItem = res.body.data.find((item: any) => item.type === 'both');
      if (bothItem) {
        expect(bothItem.hasEbook).toBe(true);
        expect(bothItem.hasAudio).toBe(true);
        expect(bothItem.availableFormats).toEqual(
          expect.arrayContaining(['ebook', 'audiobook']),
        );
      }
    });

    it('GET /v1/books/my-books?type=both returns only items supporting both reading and listening', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/books/my-books?type=both')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      for (const item of res.body.data) {
        expect(item.type).toBe('both');
        expect(item.hasEbook).toBe(true);
        expect(item.hasAudio).toBe(true);
      }
    });

    it('GET /v1/audiobooks returns audiobooks from separate audiobooks table', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/audiobooks')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);

      const first = res.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('narrator');
      expect(first).toHaveProperty('duration');
    });

    it('GET /v1/books/my-books?status=reading filters only currently reading books', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/books/my-books?status=reading')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      for (const item of res.body.data) {
        expect(item.status).toBe('reading');
      }
    });

    it('POST /v1/books/:id/reading-status updates reading status and rating', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/books/${testBookId}/reading-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          status: 'finished',
          rating: 5.0,
          progress: 100,
        })
        .expect(200);

      expect(res.body.message).toBe('تم تحديث حالة قراءة الكتاب بنجاح');
      expect(res.body.data.status).toBe('finished');
      expect(res.body.data.rating).toBe(5.0);
      expect(res.body.data.progress).toBe(100);
    });

    it('DELETE /v1/books/:id/reading-status removes book from reading list', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/books/${testBookId}/reading-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .expect(200);

      expect(res.body.message).toBe(
        'Book removed from reading list successfully',
      );
    });
  });

  describe('Posts System & Media Uploads (e2e)', () => {
    let authToken: string;
    let userId: string;
    let createdPostId: string;
    let testBookId: string;

    beforeAll(async () => {
      const jwtService = app.get(JwtService);
      const usersService = app.get(UsersService);
      const user = await usersService.findByEmail(
        'hussein.mohamed.software@gmail.com',
      );
      userId = user!.id;
      authToken = jwtService.sign({
        sub: user!.id,
        role: user!.role,
        tokenVersion: user!.tokenVersion,
      });

      const booksRes = await request(app.getHttpServer()).get(
        '/v1/books?limit=1',
      );
      testBookId = booksRes.body.data[0]?.id;
    });

    it('GET /v1/users/me/following supports search query for @ mention', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/users/me/following?search=NonExistentUser12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('POST /v1/posts creates a post and uploads video directly to R2 in a single atomic request', async () => {
      const fakeMp4Buffer = Buffer.from('fake mp4 video buffer content');
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .field('content', 'منشور مع فيديو مرفوع مباشرة إلى R2')
        .attach('video', fakeMp4Buffer, {
          filename: 'direct_post_video.mp4',
          contentType: 'video/mp4',
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المنشور بنجاح');
      expect(res.body.data.content).toBe('منشور مع فيديو مرفوع مباشرة إلى R2');
      expect(res.body.data.videoUrl).toBeDefined();
      expect(res.body.data.videoUrl).toContain(
        'https://cdn.hayahbook.com/posts/videos/',
      );
      expect(res.body.data.videoUrl).toContain('.mp4');

      // Cleanup post and its video from R2
      await request(app.getHttpServer())
        .delete(`/v1/posts/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('POST /v1/posts rejects non-mobile or legacy video formats (e.g. AVI, WMV)', async () => {
      const fakeAviBuffer = Buffer.from('fake avi content');
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .field('content', 'منشور بفيديو بصيغة غير مدعومة')
        .attach('video', fakeAviBuffer, {
          filename: 'video.avi',
          contentType: 'video/x-msvideo',
        })
        .expect(400);

      expect(res.body.message).toContain('نوع الفيديو غير مدعوم');
    });

    it('POST /v1/posts creates a post and uploads image directly to R2 in a single atomic request', async () => {
      const fakeJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .field('content', 'منشور مع صورة مرفوعة مباشرة إلى R2')
        .attach('images', fakeJpegBuffer, {
          filename: 'direct_post_image.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المنشور بنجاح');
      expect(res.body.data.content).toBe('منشور مع صورة مرفوعة مباشرة إلى R2');
      expect(Array.isArray(res.body.data.images)).toBe(true);
      expect(res.body.data.images.length).toBe(1);
      expect(res.body.data.images[0]).toContain(
        'https://cdn.hayahbook.com/posts/images/',
      );

      // Cleanup
      await request(app.getHttpServer())
        .delete(`/v1/posts/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('POST /v1/posts fails with 400 when content is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({})
        .expect(400);

      expect(res.body.message).toContain('محتوى المنشور مطلوب');
    });

    it('POST /v1/posts creates a post with text only (content is the only mandatory field)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          content: 'منشور بسيط بنص فقط بدون أي وسائط أو مرفقات',
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المنشور بنجاح');
      expect(res.body.data.content).toBe(
        'منشور بسيط بنص فقط بدون أي وسائط أو مرفقات',
      );
      expect(res.body.data.images).toEqual([]);
      expect(res.body.data.videoUrl).toBeNull();
      expect(res.body.data.link).toBeNull();
      expect(res.body.data.book).toBeNull();
      expect(res.body.data.mentions).toEqual([]);

      // Clean up text-only post
      await request(app.getHttpServer())
        .delete(`/v1/posts/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('POST /v1/posts automatically detects URL in content and populates link attachment (Facebook-style)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          content:
            'أهلاً بكم في حياة بوك، يمكنكم زيارة موقعنا https://hayahbook.com ومتابعتنا!',
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المنشور بنجاح');
      expect(res.body.data.content).toBe(
        'أهلاً بكم في حياة بوك، يمكنكم زيارة موقعنا https://hayahbook.com ومتابعتنا!',
      );
      expect(res.body.data.link).toEqual({
        url: 'https://hayahbook.com',
        title: 'hayahbook.com',
      });

      // Clean up
      await request(app.getHttpServer())
        .delete(`/v1/posts/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('POST /v1/posts automatically detects Markdown link [title](url) in content', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          content:
            'يمكنك القراءة مجاناً عبر [موقع حياة بوك](https://hayahbook.com/read)',
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المنشور بنجاح');
      expect(res.body.data.link).toEqual({
        url: 'https://hayahbook.com/read',
        title: 'موقع حياة بوك',
      });

      // Clean up
      await request(app.getHttpServer())
        .delete(`/v1/posts/${res.body.data.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('POST /v1/posts creates a post with text, image, link, book and mentions', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          type: 'post',
          content: 'تجربة منشور جديد مع كتاب ورابط وصورة',
          images: ['https://cdn.hayahbook.com/posts/images/sample.jpg'],
          link: {
            url: 'https://hayahbook.com',
            title: 'موقع حياة بوك',
          },
          bookId: testBookId,
          mentions: [userId],
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المنشور بنجاح');
      expect(res.body.data).toHaveProperty('id');
      createdPostId = res.body.data.id;
      expect(res.body.data.content).toBe(
        'تجربة منشور جديد مع كتاب ورابط وصورة',
      );
      expect(res.body.data.images).toEqual([
        'https://cdn.hayahbook.com/posts/images/sample.jpg',
      ]);
      expect(res.body.data.link.url).toBe('https://hayahbook.com');
      expect(res.body.data.book).not.toBeNull();
      expect(res.body.data.book.id).toBe(testBookId);
      expect(res.body.data.publisher.id).toBe(userId);
      expect(res.body.data.mentions.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /v1/posts returns paginated feed containing the created post', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/posts?limit=10')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find((p: any) => p.id === createdPostId);
      expect(found).toBeDefined();
    });

    it('GET /v1/posts/:id returns single post details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/posts/${createdPostId}`)
        .expect(200);

      expect(res.body.id).toBe(createdPostId);
      expect(res.body.content).toBe('تجربة منشور جديد مع كتاب ورابط وصورة');
    });

    it('DELETE /v1/posts/:id removes the post successfully', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.message).toBe('تم حذف المنشور بنجاح');
    });
  });

  describe('Articles Management (POST /v1/articles)', () => {
    let authToken: string;
    let createdArticleId: string;

    beforeAll(async () => {
      const jwtService = app.get(JwtService);
      const usersService = app.get(UsersService);
      const user = await usersService.findByEmail(
        'hussein.mohamed.software@gmail.com',
      );
      authToken = jwtService.sign({
        sub: user!.id,
        role: user!.role,
        tokenVersion: user!.tokenVersion,
      });
    });

    it('POST /v1/articles creates article when all mandatory fields are provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          agreeToTerms: true,
          title: 'قوة العادات وكيف تغير حياتك',
          content:
            'هذا مقال شامل يشرح بناء العادات اليومية وأثرها على الإنتاجية الشخصية.',
          category: 'تطوير الذات',
          coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/sample.jpg',
        })
        .expect(201);

      expect(res.body.message).toBe('تم نشر المقال بنجاح');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.type).toBe('article');
      expect(res.body.data.title).toBe('قوة العادات وكيف تغير حياتك');
      expect(res.body.data.coverImageUrl).toBe(
        'https://cdn.hayahbook.com/articles/covers/sample.jpg',
      );
      expect(res.body.data.category).toBe('تطوير الذات');
      expect(res.body.data.content).toContain('هذا مقال شامل');
      createdArticleId = res.body.data.id;
    });

    it('POST /v1/articles fails with 400 when agreeToTerms is missing or false', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          agreeToTerms: false,
          title: 'عنوان المقال',
          content: 'نص المقال الكامل...',
          category: 'تطوير الذات',
          coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/sample.jpg',
        })
        .expect(400);

      expect(res.body.message).toContain(
        'يجب الموافقة على الشروط والخصوصية لمجتمع Hayahbook',
      );
    });

    it('POST /v1/articles fails with 400 when title is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          agreeToTerms: true,
          content: 'نص المقال فقط بدون عنوان',
          category: 'تطوير الذات',
          coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/sample.jpg',
        })
        .expect(400);

      expect(res.body.message).toContain('عنوان المقال مطلوب');
    });

    it('POST /v1/articles fails with 400 when cover image is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          agreeToTerms: true,
          title: 'عنوان المقال',
          content: 'نص المقال بدون صورة رئيسية',
          category: 'تطوير الذات',
        })
        .expect(400);

      expect(res.body.message).toContain('الصورة الرئيسية للمقال مطلوبة');
    });

    it('POST /v1/articles fails with 400 when category is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          agreeToTerms: true,
          title: 'عنوان المقال',
          content: 'نص المقال بدون تصنيف',
          coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/sample.jpg',
        })
        .expect(400);

      expect(res.body.message).toContain('تصنيف المقال مطلوب');
    });

    it('POST /v1/articles fails with 400 when content is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .send({
          agreeToTerms: true,
          title: 'عنوان المقال',
          category: 'تطوير الذات',
          coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/sample.jpg',
        })
        .expect(400);

      expect(res.body.message).toContain('نص المقال مطلوب');
    });

    it('POST /v1/articles fails with 400 and translates in English when content is missing and Accept-Language is en', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/articles')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({
          agreeToTerms: true,
          title: 'Article Title',
          category: 'Self development',
          coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/sample.jpg',
        })
        .expect(400);

      expect(res.body.message).toContain('Article content is required');
    });

    it('GET /v1/articles returns feed of articles', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/articles')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((a: any) => a.id === createdArticleId);
      expect(found).toBeDefined();
      expect(found.title).toBe('قوة العادات وكيف تغير حياتك');
    });

    it('GET /v1/articles/:id returns single article details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/articles/${createdArticleId}`)
        .expect(200);

      expect(res.body.id).toBe(createdArticleId);
      expect(res.body.title).toBe('قوة العادات وكيف تغير حياتك');
    });

    it('DELETE /v1/articles/:id deletes article successfully', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/v1/articles/${createdArticleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'ar')
        .expect(200);

      expect(res.body.message).toBe('تم حذف المقال بنجاح');
    });
  });
});
