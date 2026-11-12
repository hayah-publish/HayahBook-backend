import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './post.entity';
import { PostReaction } from './post-reaction.entity';
import { PostReport } from './post-report.entity';
import { UserHiddenPost } from './user-hidden-post.entity';
import { User } from '../users/user.entity';
import { UserUserFollow } from '../users/user-user-follow.entity';
import { UserBlock } from '../users/user-block.entity';
import { UserBookmark } from '../bookmarks/bookmark.entity';
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';
import { UserBookExcerpt } from '../books/user-book-excerpt.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { ArticlesController } from './articles.controller';
import { SnippetsController } from './snippets.controller';
import { QuotesController } from './quotes.controller';
import { VisualsController } from './visuals.controller';
import { ReactionsController } from './reactions.controller';
import { UploadModule } from '../upload/upload.module';
import { I18nModule } from '../i18n/i18n.module';
import { InterestsModule } from '../interests/interests.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      PostReaction,
      PostReport,
      UserHiddenPost,
      User,
      UserUserFollow,
      UserBlock,
      UserBookmark,
      Book,
      Audiobook,
      UserBookExcerpt,
    ]),
    UploadModule,
    I18nModule,
    InterestsModule,
  ],
  controllers: [
    PostsController,
    ArticlesController,
    SnippetsController,
    QuotesController,
    VisualsController,
    ReactionsController,
  ],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}

