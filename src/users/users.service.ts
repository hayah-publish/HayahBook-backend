
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async createUser(email: string): Promise<User> {
    const user = this.usersRepository.create({
      email: email.toLowerCase().trim(),
      role: 'user',
      isActive: true,
      emailVerified: false,
    });

    return this.usersRepository.save(user);
  }

  async markEmailVerified(id: string): Promise<User> {
    await this.usersRepository.update(id, { emailVerified: true });
    const user = await this.findById(id);
    return user!;
  }
}
