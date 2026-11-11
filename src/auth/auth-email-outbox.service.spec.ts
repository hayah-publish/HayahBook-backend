import { ConfigService } from '@nestjs/config';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import { AuthEmailOutbox } from './auth-email-outbox.entity';
import { AuthEmailOutboxService } from './auth-email-outbox.service';

function makeService(values: Record<string, string | undefined>) {
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new AuthEmailOutboxService({} as any, {} as any, config);
}

describe('AuthEmailOutboxService encryption configuration', () => {
  it('requires an independent 32-byte key in production', () => {
    expect(() =>
      makeService({
        NODE_ENV: 'production',
        JWT_SECRET: 'jwt-secret',
        RESEND_API_KEY: 're_test',
      }),
    ).toThrow('MAIL_OUTBOX_ENCRYPTION_KEY is required in production');
    expect(() =>
      makeService({
        NODE_ENV: 'production',
        MAIL_OUTBOX_ENCRYPTION_KEY: 'invalid',
        RESEND_API_KEY: 're_test',
      }),
    ).toThrow('MAIL_OUTBOX_ENCRYPTION_KEY is required in production');
  });

  it('accepts a valid key in production and retains development fallback', () => {
    expect(() =>
      makeService({
        NODE_ENV: 'production',
        MAIL_OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        RESEND_API_KEY: 're_test',
      }),
    ).not.toThrow();
    expect(() =>
      makeService({ NODE_ENV: 'development', JWT_SECRET: 'jwt-secret' }),
    ).not.toThrow();
  });

  it('can decrypt outbox payloads encrypted with the previous JWT-derived key', () => {
    const secret = 'jwt-secret';
    const legacyKey = createHash('sha256')
      .update(secret + ':outbox-encryption')
      .digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
    const payload = {
      to: 'user@example.com',
      subject: 'Verify',
      html: '<p>Code</p>',
    };
    const encryptedPayload = Buffer.concat([
      cipher.update(JSON.stringify(payload)),
      cipher.final(),
    ]).toString('base64');
    const service = makeService({
      NODE_ENV: 'production',
      JWT_SECRET: secret,
      MAIL_OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString('base64'),
      RESEND_API_KEY: 're_test',
    });
    const row = {
      encryptedPayload,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
    } as AuthEmailOutbox;
    expect((service as any).decrypt(row)).toEqual(payload);
  });
});
