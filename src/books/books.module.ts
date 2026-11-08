import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksController } from './books.controller';
import { AudiobooksController } from './audiobooks.controller';
import { BooksService } from './books.service';
import { Book } from './book.entity';
import { Audiobook } from './audiobook.entity';
import { UserBook } from './user-book.entity';
import { User } from '../users/user.entity';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Book, Audiobook, UserBook, User])],
  controllers: [BooksController, AudiobooksController],
  providers: [BooksService, AdminGuard],
  exports: [BooksService],
})
export class BooksModule {}
