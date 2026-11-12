import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Audiobook } from './audiobook.entity';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  author: string | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'ebook' })
  contentType: string;

  @Column({ type: 'text', nullable: true })
  coverUrl: string | null;

  @Column({ type: 'text', nullable: true })
  contentUrl: string | null;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 4.5 })
  rating: number;

  @Column({ type: 'integer', default: 0 })
  views: number;

  @Column({ name: 'reads_count', type: 'integer', default: 0 })
  readsCount: number;

  @Column({ name: 'pages_count', type: 'integer', default: 500, nullable: true })
  pagesCount: number | null;

  @OneToMany(() => Audiobook, (audiobook) => audiobook.book)
  audiobooks: Audiobook[];

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
