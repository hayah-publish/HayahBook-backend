import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import type { ReactionType } from '../posts/post-reaction.entity';

@Entity('comment_reactions')
@Index('uq_comment_reactions_comment_user', ['commentId', 'userId'], { unique: true })
@Index(['commentId', 'reactionType'])
export class CommentReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'comment_id', type: 'uuid' })
  commentId: string;

  @ManyToOne(() => Comment, (c) => c.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'reaction_type', type: 'varchar', length: 20 })
  reactionType: ReactionType;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
