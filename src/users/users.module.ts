import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserUserFollow } from './user-user-follow.entity';
import { UserBlock } from './user-block.entity';
import { Author } from '../authors/author.entity';
import { Creator } from '../creators/creator.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Author, Creator, UserUserFollow, UserBlock]),
    I18nModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
