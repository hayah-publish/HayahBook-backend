import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Interest } from '../interests/interest.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, default: 'user' })
  role: 'user' | 'admin';

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'emailVerified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'acceptTerms', type: 'boolean', default: false })
  acceptTerms: boolean;

  @Column({ name: 'profileCompleted', type: 'boolean', default: false })
  profileCompleted: boolean;

  @Column({ name: 'interestsSelected', type: 'boolean', default: false })
  interestsSelected: boolean;

  @Column({ name: 'authorsSelected', type: 'boolean', default: false })
  authorsSelected: boolean;

  @Column({ name: 'creatorsSelected', type: 'boolean', default: false })
  creatorsSelected: boolean;

  @Column({ name: 'followersCount', type: 'integer', default: 0 })
  followersCount: number;

  @Column({ name: 'followingCount', type: 'integer', default: 0 })
  followingCount: number;

  @Column({ name: 'userType', type: 'varchar', length: 50, default: 'Reader' })
  userType: string;

  @Column({ name: 'language', type: 'varchar', length: 10, default: 'ar' })
  language: 'ar' | 'en';

  @Column({ name: 'readingLanguage', type: 'varchar', length: 50, nullable: true, default: null })
  readingLanguage: string | null;

  @Column({ name: 'tokenversion', type: 'integer', default: 1 })
  tokenVersion: number;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'countryCode', type: 'varchar', length: 10, nullable: true })
  countryCode: string | null;

  @Column({ type: 'date', nullable: true })
  birthday: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'aboutMe', type: 'text', nullable: true })
  aboutMe: string | null;

  @Column({ name: 'profileUrl', type: 'text', nullable: true })
  profileUrl: string | null;

  @ManyToMany(() => Interest, { eager: false })
  @JoinTable({
    name: 'user_interests',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'interest_id', referencedColumnName: 'id' },
  })
  interests: Interest[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
