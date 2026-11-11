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

@Entity('user_book_excerpts')
@Index('idx_user_book_excerpts_user_book', ['userId', 'bookId'])
@Index('idx_user_book_excerpts_user_created', ['userId', 'createdAt'])
@Index('idx_user_book_excerpts_book', ['bookId'])
export class UserBookExcerpt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  chapter: string | null;

  @Column({ name: 'page_number', type: 'integer', nullable: true })
  pageNumber: number | null;

  @Column({ type: 'varchar', length: 30, default: '#FF7A00' })
  color: string;

  @Column({ name: 'cfi_range', type: 'varchar', length: 255, nullable: true })
  cfiRange: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
