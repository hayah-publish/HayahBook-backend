import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { Resend } from 'resend';
import { AuthEmailOutbox } from './auth-email-outbox.entity';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class AuthEmailOutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthEmailOutboxService.name);
  private readonly encryptionKey: Buffer;
  private readonly resend: Resend;
  private readonly sender: string;
  private timer?: NodeJS.Timeout;
  private processing = false;

  constructor(
    @InjectRepository(AuthEmailOutbox)
    private readonly outboxRepository: Repository<AuthEmailOutbox>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const isTest =
      config.get<string>('NODE_ENV') === 'test' ||
      process.env.NODE_ENV === 'test';
    const encodedKey = config.get<string>('MAIL_OUTBOX_ENCRYPTION_KEY');
    let key = encodedKey ? Buffer.from(encodedKey, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      if (isTest) {
        key = Buffer.alloc(32, 7);
      } else {
        throw new Error(
          'MAIL_OUTBOX_ENCRYPTION_KEY must be a base64 encoded 32-byte key',
        );
      }
    }
    this.encryptionKey = key;

    const apiKey =
      config.get<string>('RESEND_API_KEY') ||
      (isTest ? 're_test_mock_api_key' : '');
    this.sender =
      config.get<string>('RESEND_FROM_EMAIL') ??
      (isTest ? 'noreply@example.com' : '');
    if (!apiKey && !isTest) {
      throw new Error('RESEND_API_KEY is missing from environment variables');
    }
    if (!this.sender && !isTest) {
      throw new Error('RESEND_FROM_EMAIL is missing from environment variables');
    }
    this.resend = new Resend(apiKey || 're_test_mock_api_key');
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.processBatch(), 5_000);
    this.timer.unref();
    void this.processBatch();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(payload: EmailPayload): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encryptedPayload = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]).toString('base64');

    await this.outboxRepository.save(this.outboxRepository.create({
      recipient: null,
      subject: null,
      encryptedPayload,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      status: 'pending',
      attempts: 0,
      availableAt: new Date(),
      lockUntil: null,
      sentAt: null,
      lastError: null,
    }));
  }

  private decrypt(row: AuthEmailOutbox): EmailPayload {
    if (!row.encryptedPayload) throw new Error('Missing encrypted payload');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(row.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(row.authTag, 'hex'));
    const json = Buffer.concat([
      decipher.update(Buffer.from(row.encryptedPayload, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(json) as EmailPayload;
  }

  async processBatch(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const jobs: AuthEmailOutbox[] = await this.dataSource.transaction(async (manager) => {
        const selected = await manager.query(
          `SELECT id FROM auth_email_outbox
           WHERE (status = 'pending' AND available_at <= now())
              OR (status = 'processing' AND lock_until <= now())
           ORDER BY created_at
           LIMIT 10
           FOR UPDATE SKIP LOCKED`,
        );
        if (selected.length === 0) return [];
        const ids = selected.map((row: { id: string }) => row.id);
        await manager.query(
          `UPDATE auth_email_outbox
           SET status = 'processing', lock_until = now() + interval '2 minutes', attempts = attempts + 1
           WHERE id = ANY($1::uuid[])`,
          [ids],
        );
        return manager.getRepository(AuthEmailOutbox).findBy({ id: In(ids) });
      });

      for (const job of jobs) await this.deliver(job);
    } catch {
      this.logger.error('Outbox polling failed');
    } finally {
      this.processing = false;
    }
  }

  private async deliver(job: AuthEmailOutbox): Promise<void> {
    try {
      const payload = this.decrypt(job);
      const { error } = await this.resend.emails.send({
        from: this.sender,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      if (error) throw new Error(error.name || 'email_delivery_failed');

      await this.outboxRepository.update(job.id, {
        status: 'sent',
        recipient: null,
        subject: null,
        encryptedPayload: null,
        lockUntil: null,
        sentAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const retryDelayMs = Math.min(60 * 60_000, 10_000 * 2 ** Math.min(job.attempts, 8));
      const message = error instanceof Error ? error.name : 'delivery_failed';
      const failed = job.attempts >= 8;
      await this.outboxRepository.update(job.id, {
        status: failed ? 'failed' : 'pending',
        availableAt: new Date(Date.now() + retryDelayMs),
        lockUntil: null,
        lastError: message.slice(0, 100),
      });
      this.logger.warn(`Queued email delivery attempt ${job.attempts} failed (${message})`);
    }
  }
}
