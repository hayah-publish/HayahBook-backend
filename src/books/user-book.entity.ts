import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Book } from './book.entity';
import { Audiobook } from './audiobook.entity';
import { UserAlias } from '../aliases/user-alias.entity';

export type ReadingStatus = 'finished' | 'reading' | 'want_to_read';

@Entity('user_books')
@Index('uq_user_books_user_book', ['userId', 'bookId'], { unique: true, where: 'book_id IS NOT NULL' })
@Index('uq_user_books_user_audiobook', ['userId', 'audiobookId'], { unique: true, where: 'audiobook_id IS NOT NULL' })
@Index(['userId', 'status'])
export class UserBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'book_id', type: 'uuid', nullable: true })
  bookId: string | null;

  @Column({ name: 'audiobook_id', type: 'uuid', nullable: true })
  audiobookId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Book, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book | null;

  @ManyToOne(() => Audiobook, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'audiobook_id' })
  audiobook: Audiobook | null;

  @Column({ type: 'varchar', length: 20, default: 'reading' })
  status: ReadingStatus;

  @Column({ type: 'integer', default: 0 })
  progress: number;

  @Column({ type: 'decimal', precision: 2, scale: 1, nullable: true })
  rating: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'identity_type', type: 'varchar', length: 20, default: 'primary' })
  identityType: 'primary' | 'alias';

  @Index()
  @Column({ name: 'alias_id', type: 'uuid', nullable: true })
  aliasId: string | null;

  @ManyToOne(() => UserAlias, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'alias_id' })
  alias: UserAlias | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

