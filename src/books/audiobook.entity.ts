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
import { Book } from './book.entity';

@Entity('audiobooks')
export class Audiobook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  author: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  narrator: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  coverUrl: string | null;

  @Column({ type: 'text', nullable: true })
  audioUrl: string | null;

  @Column({ type: 'integer', default: 0 })
  duration: number; // Duration in seconds

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 4.5 })
  rating: number;

  @Column({ type: 'integer', default: 0 })
  views: number;

  @Column({ name: 'listens_count', type: 'integer', default: 0 })
  listensCount: number;

  @Column({ name: 'book_id', type: 'uuid', nullable: true })
  bookId: string | null;

  @ManyToOne(() => Book, (book) => book.audiobooks, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'book_id' })
  book: Book | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
