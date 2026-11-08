import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Author } from './author.entity';
import { UserAuthorFollow } from './user-author-follow.entity';
import { User } from '../users/user.entity';
import { Interest } from '../interests/interest.entity';
import { AuthorsService } from './authors.service';
import { AuthorsController } from './authors.controller';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Author, UserAuthorFollow, User, Interest]),
    I18nModule,
  ],
  controllers: [AuthorsController],
  providers: [AuthorsService],
  exports: [AuthorsService],
})
export class AuthorsModule {}

