import { AuthRateLimitMiddleware } from './auth-rate-limit.middleware';

describe('AuthRateLimitMiddleware', () => {
  it('uses the application IP and email rather than an untrusted forwarded IP header', async () => {
    const consume = jest.fn().mockResolvedValue(true);
    const middleware = new AuthRateLimitMiddleware({ consume } as any);
    const req = {
      method: 'POST',
      path: '/v1/auth/login',
      ip: '192.0.2.10',
      socket: { remoteAddress: '192.0.2.10' },
      body: { email: ' Person@Example.com ' },
      headers: { 'x-forwarded-for': '198.51.100.9' },
      header: (name: string) => name === 'x-forwarded-for' ? '198.51.100.9' : undefined,
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(consume).toHaveBeenCalledWith('login-ip', '192.0.2.10', 10, 900_000);
    expect(consume).toHaveBeenCalledWith('login-identity', 'person@example.com', 10, 900_000);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('applies the five-per-target OTP request limit', async () => {
    const consume = jest.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const middleware = new AuthRateLimitMiddleware({ consume } as any);
    const req = {
      method: 'POST',
      path: '/v1/auth/otp/signup',
      ip: '192.0.2.10',
      socket: { remoteAddress: '192.0.2.10' },
      body: { email: 'person@example.com' },
      header: () => undefined,
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(consume).toHaveBeenCalledWith('otp-target', 'person@example.com', 5, 900_000);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['DELETE', '/v1/auth/account'],
    ['PATCH', '/v1/auth/phone'],
  ])('limits OTP protected %s %s requests', async (method, path) => {
    const consume = jest.fn().mockResolvedValue(true);
    const middleware = new AuthRateLimitMiddleware({ consume } as any);
    const req = {
      method,
      path,
      ip: '192.0.2.11',
      socket: { remoteAddress: '192.0.2.11' },
      body: { email: 'person@example.com', phone: '201234567890' },
      header: () => undefined,
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(consume).toHaveBeenCalledWith('otp-verify-ip', '192.0.2.11', 30, 900_000);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rate limits Google login attempts per IP', async () => {
    const consume = jest.fn().mockResolvedValue(true);
    const middleware = new AuthRateLimitMiddleware({ consume } as any);
    const req = {
      method: 'POST',
      path: '/v1/auth/google',
      ip: '192.0.2.12',
      socket: { remoteAddress: '192.0.2.12' },
      body: { idToken: 'opaque-token' },
      header: () => undefined,
    } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(consume).toHaveBeenCalledWith('login-ip', '192.0.2.12', 10, 900_000);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('normalizes mixed-case and trailing-slash auth paths and stops after 429 on post share', async () => {
    const consume = jest.fn().mockResolvedValue(false);
    const middleware = new AuthRateLimitMiddleware({ consume } as any);
    const shareReq = {
      method: 'POST',
      path: '/v1/Posts/123e4567-e89b-12d3-a456-426614174000/Share/',
      ip: '192.0.2.13',
      socket: { remoteAddress: '192.0.2.13' },
      header: () => undefined,
    } as any;
    const shareRes = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const shareNext = jest.fn();

    await middleware.use(shareReq, shareRes, shareNext);

    expect(shareRes.status).toHaveBeenCalledWith(429);
    expect(shareNext).not.toHaveBeenCalled();
  });
});
