import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { PostReaction } from './post-reaction.entity';
import { User } from '../users/user.entity';
import { UserUserFollow } from '../users/user-user-follow.entity';
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { ArticlesController } from './articles.controller';
import { ReactionsController } from './reactions.controller';
import { UploadModule } from '../upload/upload.module';
import { I18nModule } from '../i18n/i18n.module';
import { InterestsModule } from '../interests/interests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, PostReaction, User, UserUserFollow, Book, Audiobook]),
    UploadModule,
    I18nModule,
    InterestsModule,
  ],
  controllers: [PostsController, ArticlesController, ReactionsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}

