import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('interests')
@Index(['name_ar', 'category_ar'], { unique: true })
export class Interest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index()
  @Column({ name: 'name_ar', type: 'varchar', length: 100, nullable: true })
  name_ar: string;

  @Index()
  @Column({ name: 'name_en', type: 'varchar', length: 100, nullable: true })
  name_en: string;

  @Index()
  @Column({ type: 'varchar', length: 50, default: 'الكتب' })
  category: string;

  @Index()
  @Column({ name: 'category_ar', type: 'varchar', length: 50, default: 'الكتب' })
  category_ar: string;

  @Index()
  @Column({ name: 'category_en', type: 'varchar', length: 50, default: 'Books' })
  category_en: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
