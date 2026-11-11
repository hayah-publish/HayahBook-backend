import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAlias } from './user-alias.entity';
import { User } from '../users/user.entity';
import { Comment } from '../comments/comment.entity';
import { UserBook } from '../books/user-book.entity';
import { UploadModule } from '../upload/upload.module';
import { AliasesService } from './aliases.service';
import { AliasesController } from './aliases.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAlias, User, Comment, UserBook]),
    UploadModule,
  ],
  controllers: [AliasesController],
  providers: [AliasesService],
  exports: [AliasesService, TypeOrmModule],
})
export class AliasesModule {}

