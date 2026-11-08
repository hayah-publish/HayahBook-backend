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
import { Post } from './post.entity';
import { User } from '../users/user.entity';

export type ReactionType =
  | 'agree'
  | 'love'
  | 'applaud'
  | 'insightful'
  | 'disagree';

export interface PostReactionsCount {
  total: number;
  agree: number;
  love: number;
  applaud: number;
  insightful: number;
  disagree: number;
}

@Entity('post_reactions')
@Index(['postId', 'userId'], { unique: true })
@Index(['postId', 'reactionType'])
@Index(['postId', 'createdAt'])
@Index(['userId'])
export class PostReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'reaction_type', type: 'varchar', length: 20 })
  reactionType: ReactionType;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

