import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './comment.entity';
import { CommentReaction } from './comment-reaction.entity';
import { CommentMute } from './comment-mute.entity';
import { CommentReport } from './comment-report.entity';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { ContentCommentsController } from './content-comments.controller';
import { UploadModule } from '../upload/upload.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Comment,
      CommentReaction,
      CommentMute,
      CommentReport,
      Post,
      User,
    ]),
    UploadModule,
    I18nModule,
  ],
  controllers: [CommentsController, ContentCommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}

