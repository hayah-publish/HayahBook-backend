import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuthEmailOutboxStatus = 'pending' | 'processing' | 'sent' | 'failed';

@Entity('auth_email_outbox')
@Index(['status', 'availableAt'])
export class AuthEmailOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subject: string | null;

  @Column({ name: 'encrypted_payload', type: 'text', nullable: true })
  encryptedPayload: string | null;

  @Column({ type: 'char', length: 24 })
  iv: string;

  @Column({ name: 'auth_tag', type: 'char', length: 32 })
  authTag: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: AuthEmailOutboxStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'available_at', type: 'timestamptz', default: () => 'now()' })
  availableAt: Date;

  @Column({ name: 'lock_until', type: 'timestamptz', nullable: true })
  lockUntil: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'last_error', type: 'varchar', length: 100, nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
