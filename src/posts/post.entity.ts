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
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';

export type PostType = 'post' | 'article';

@Entity('posts')
@Index(['userId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20, default: 'post' })
  type: PostType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ name: 'video_url', type: 'text', nullable: true })
  videoUrl: string | null;

  @Column({ name: 'link_url', type: 'text', nullable: true })
  linkUrl: string | null;

  @Column({ name: 'link_title', type: 'varchar', length: 255, nullable: true })
  linkTitle: string | null;

  @Column({ name: 'book_id', type: 'uuid', nullable: true })
  bookId: string | null;

  @ManyToOne(() => Book, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'book_id' })
  book: Book | null;

  @Column({ name: 'audiobook_id', type: 'uuid', nullable: true })
  audiobookId: string | null;

  @ManyToOne(() => Audiobook, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'audiobook_id' })
  audiobook: Audiobook | null;

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  mentions: string[]; // User IDs mentioned

  @Column({ name: 'likes_count', type: 'integer', default: 0 })
  likesCount: number;

  @Column({ name: 'comments_count', type: 'integer', default: 0 })
  commentsCount: number;

  @Column({ name: 'shares_count', type: 'integer', default: 0 })
  sharesCount: number;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

