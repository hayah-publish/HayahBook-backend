import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  constructor(private readonly limits: AuthRateLimitService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const path =
      req.path
        .toLowerCase()
        .replace(/^\/v\d+(?=\/)/, '')
        .replace(/\/+$/, '') || '/';
    const shareMatch = path.match(
      /^\/(?:posts|articles)\/([0-9a-f-]+)\/share$/i,
    );
    if (shareMatch && req.method === 'POST') {
      const identity = req.ip || req.socket.remoteAddress || 'unknown';
      const [perPostAllowed, perIpAllowed] = await Promise.all([
        this.limits.consume(
          'share-identity',
          identity + ':' + shareMatch[1],
          5,
          60_000,
        ),
        this.limits.consume(
          'share-ip',
          req.ip || req.socket.remoteAddress || 'unknown',
          30,
          60_000,
        ),
      ]);
      if (perPostAllowed && perIpAllowed) return next();
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Try again later.',
      });
      return;
    }
    if (!path.startsWith('/auth/')) return next();

    const otpRequest =
      path === '/auth/signup' ||
      path === '/auth/request-otp' ||
      path === '/auth/forgot-password' ||
      path === '/auth/otp/forgot-password' ||
      (path.startsWith('/auth/otp/') && !path.includes('verify')) ||
      path === '/auth/signup/otp';
    const otpVerification =
      (path.startsWith('/auth/otp/') && path.includes('verify')) ||
      (path.startsWith('/auth/verify-') && path !== '/auth/verify-otp') ||
      path === '/auth/reset-password' ||
      path === '/auth/change-password' ||
      path === '/auth/change-email' ||
      (path === '/auth/account' && req.method === 'DELETE') ||
      (path === '/auth/phone' && req.method === 'PATCH');
    const loginAttempt =
      req.method === 'POST' &&
      (path === '/auth/login' ||
        path === '/auth/verify-otp' ||
        path === '/auth/google');
    if (otpRequest && req.method !== 'POST') return next();
    if (otpVerification && !['POST', 'DELETE', 'PATCH'].includes(req.method))
      return next();
    if (!otpRequest && !otpVerification && !loginAttempt) return next();

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const body = req.body as Record<string, unknown> | undefined;
    const authorization = req.header('authorization') ?? '';
    const bearerIdentity = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    const targetValue = [body?.email, body?.newEmail, body?.phone].find(
      (value): value is string => typeof value === 'string',
    );
    const target = (targetValue ?? bearerIdentity).trim().toLowerCase();
    if (otpRequest) {
      const policies: Promise<boolean>[] = [
        this.limits.consume('otp-ip', ip, 20, 15 * 60_000),
      ];
      if (target)
        policies.push(
          this.limits.consume('otp-target', target, 5, 15 * 60_000),
          this.limits.consume('otp-target-cooldown', target, 1, 60_000),
        );
      if ((await Promise.all(policies)).every(Boolean)) return next();
    } else if (otpVerification) {
      const [ipAllowed, targetAllowed] = await Promise.all([
        this.limits.consume('otp-verify-ip', ip, 30, 15 * 60_000),
        target
          ? this.limits.consume('otp-verify-target', target, 10, 15 * 60_000)
          : Promise.resolve(true),
      ]);
      if (ipAllowed && targetAllowed) return next();
    } else {
      const [ipAllowed, identityAllowed] = await Promise.all([
        this.limits.consume('login-ip', ip, 10, 15 * 60_000),
        this.limits.consume('login-identity', target || ip, 10, 15 * 60_000),
      ]);
      if (ipAllowed && identityAllowed) return next();
    }
    res.status(429).json({
      statusCode: 429,
      message: 'Too many requests. Try again later.',
    });
  }
}
