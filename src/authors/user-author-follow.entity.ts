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
import { Author } from './author.entity';

@Entity('user_author_follows')
@Index('uq_user_author_follows_pair', ['userId', 'authorId'], { unique: true })
export class UserAuthorFollow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Author, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: Author;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

// Backward-compatibility alias
export { UserAuthorFollow as UserFollow };

