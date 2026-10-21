
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseUUIDPipe,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { BooksQueryDto } from './dto/books-query.dto';
import { BooksService } from './books.service';
import { Book } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}



@Get()
findAll(
  @Query() query: BooksQueryDto,
): Promise<{ data: Book[]; total: number }> {
  return this.booksService.findAll(
    query.page,
    query.limit,
  );
}

@Get('latest')
getLatestBooks(
  @Query() query: BooksQueryDto,
): Promise<{ data: Book[]; total: number }> {
  return this.booksService.findAll(1, query.limit);
}

@UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() createBookDto: CreateBookDto): Promise<Book> {
    return this.booksService.create(createBookDto);
  }

  @Patch(':id')
update(
  @Param('id', new ParseUUIDPipe()) id: string,
  @Body() updateBookDto: UpdateBookDto,
): Promise<Book> {
  return this.booksService.update(id, updateBookDto);
}

@Delete(':id')
remove(
  @Param('id', new ParseUUIDPipe()) id: string,
): Promise<void> {
  return this.booksService.remove(id);
}




@Get('search')
search(
  @Query() query: BooksQueryDto,
): Promise<{ data: Book[]; total: number }> {
  if (!query.q || !query.q.trim()) {
    throw new BadRequestException('اكتب كلمة للبحث');
  }

  return this.booksService.search(
    query.q.trim(),
    query.page,
    query.limit,
  );
}



  @Get('type/:type')
  findByType(
    @Param('type') type: string,
    @Query() query: BooksQueryDto,
  ): Promise<{ data: Book[]; total: number }> {
    if (type !== 'ebook' && type !== 'audiobook') {
      throw new BadRequestException(
        'النوع يجب أن يكون ebook أو audiobook',
      );
    }

    return this.booksService.findByType(type, query.page, query.limit);
  }


@Get('filter')
filterBooks(
  @Query() query: BooksQueryDto,
): Promise<{ data: Book[]; total: number }> {
return this.booksService.filterBooks(
  query.page,
  query.limit,
  query.q,
  query.type,
  query.category,
);
}

@Get('categories')
getCategoryCounts(): Promise<{ category: string; count: number }[]> {
  return this.booksService.getCategoryCounts();
}


@Get(':id')
findOne(
  @Param('id', new ParseUUIDPipe()) id: string,
): Promise<Book> {
  return this.booksService.findOne(id);
}

}
