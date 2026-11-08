import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createHmac, randomInt, randomUUID } from 'crypto';

@Injectable()
export class AuthRateLimitService {
  private readonly pepper: string;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is missing from environment variables');
    this.pepper = secret;
  }

  async consume(policy: string, identity: string, limit: number, windowMs: number): Promise<boolean> {
    const key = `${policy}:${createHmac('sha256', this.pepper).update(identity).digest('hex')}`;
    if (randomInt(100) === 0) {
      await this.dataSource.query(
        'DELETE FROM auth_rate_limits WHERE window_ends_at <= now()',
      );
    }

    const rows: Array<{ hits: number }> = await this.dataSource.query(
      `INSERT INTO auth_rate_limits (key, hits, window_ends_at)
       VALUES ($1, 1, now() + ($2 * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN auth_rate_limits.window_ends_at <= now() THEN 1 ELSE auth_rate_limits.hits + 1 END,
         window_ends_at = CASE WHEN auth_rate_limits.window_ends_at <= now()
           THEN now() + ($2 * interval '1 millisecond') ELSE auth_rate_limits.window_ends_at END
       RETURNING hits`,
      [key, windowMs],
    );

    return Number(rows[0]?.hits ?? limit + 1) <= limit;
  }
}
