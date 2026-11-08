import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('auth_rate_limits')
export class AuthRateLimit {
  @PrimaryColumn({ type: 'varchar', length: 96 })
  key: string;

  @Column({ type: 'integer' })
  hits: number;

  @Column({ name: 'window_ends_at', type: 'timestamptz' })
  windowEndsAt: Date;
}
