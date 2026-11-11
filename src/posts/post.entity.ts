import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';
import type { PostReactionsCount } from './post-reaction.entity';
import type { Comment } from '../comments/comment.entity';

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

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'content_format', type: 'varchar', length: 20, default: 'markdown', nullable: true })
  contentFormat: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ name: 'video_url', type: 'text', nullable: true })
  videoUrl: string | null;

  @Index()
  @Column({ name: 'contain_video', type: 'boolean', default: false })
  containVideo: boolean;

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

  @Column({
    name: 'reactions_count',
    type: 'jsonb',
    default: () =>
      `'{"total":0,"agree":0,"love":0,"applaud":0,"insightful":0,"disagree":0}'`,
  })
  reactionsCount: PostReactionsCount;

  @Column({ name: 'comments_count', type: 'integer', default: 0 })
  commentsCount: number;

  @Column({ name: 'comments_disabled', type: 'boolean', default: false })
  commentsDisabled: boolean;

  @OneToMany('Comment', 'post')
  comments?: Comment[];

  @Column({ name: 'shares_count', type: 'integer', default: 0 })
  sharesCount: number;

  @Column({ name: 'bookmarks_count', type: 'integer', default: 0 })
  bookmarksCount: number;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

