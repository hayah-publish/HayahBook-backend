import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('authors')
export class Author {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'countryCode', type: 'varchar', length: 10, nullable: true })
  countryCode: string | null;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'birthday', type: 'date', nullable: true })
  birthday: string | null;

  @Column({ name: 'show_email', type: 'boolean', default: false })
  showEmail: boolean;

  @Column({ name: 'show_phone', type: 'boolean', default: false })
  showPhone: boolean;

  @Column({ name: 'show_birthday', type: 'boolean', default: false })
  showBirthday: boolean;

  @Column({ name: 'aboutMe', type: 'text', nullable: true })
  aboutMe: string | null;

  @Column({ name: 'profileUrl', type: 'text', nullable: true })
  profileUrl: string | null;

  @Column({ name: 'userType', type: 'varchar', length: 50, default: 'Author' })
  userType: string;

  @Column({ name: 'role', type: 'varchar', length: 20, default: 'author' })
  role: string;

  @Column({ name: 'isVerified', type: 'boolean', default: true })
  isVerified: boolean;

  @Column({ name: 'followersCount', type: 'integer', default: 0 })
  followersCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
