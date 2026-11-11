import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksController } from './books.controller';
import { AudiobooksController } from './audiobooks.controller';
import {
  BookExcerptsController,
  DirectExcerptsController,
} from './book-excerpts.controller';
import { BooksService } from './books.service';
import { BookExcerptsService } from './book-excerpts.service';
import { Book } from './book.entity';
import { Audiobook } from './audiobook.entity';
import { UserBook } from './user-book.entity';
import { UserBookExcerpt } from './user-book-excerpt.entity';
import { User } from '../users/user.entity';
import { AdminGuard } from '../auth/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Book, Audiobook, UserBook, User, UserBookExcerpt]),
  ],
  controllers: [
    BooksController,
    AudiobooksController,
    BookExcerptsController,
    DirectExcerptsController,
  ],
  providers: [BooksService, BookExcerptsService, AdminGuard],
  exports: [BooksService, BookExcerptsService],
})
export class BooksModule {}
