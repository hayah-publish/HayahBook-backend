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
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { BooksQueryDto } from './dto/books-query.dto';
import { MyBooksQueryDto } from './dto/my-books-query.dto';
import { UpdateReadingStatusDto } from './dto/update-reading-status.dto';
import { BooksService, PaginatedResult } from './books.service';
import { Book } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { I18nService } from '../i18n/i18n.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  findAll(
    @Query() query: BooksQueryDto,
  ): Promise<PaginatedResult<Book>> {
    return this.booksService.filterBooks(
      query.page,
      query.limit,
      query.q,
      query.type,
      query.category,
    );
  }

  @Get('latest')
  getLatestBooks(
    @Query() query: BooksQueryDto,
  ): Promise<PaginatedResult<Book>> {
    return this.booksService.findAll(1, query.limit);
  }
  @UseGuards(JwtAuthGuard)
  @Get('my-books')
  getMyBooks(
    @Req() req: AuthenticatedRequest,
    @Query() query: MyBooksQueryDto,
  ) {
    return this.booksService.getMyBooks(req.user.userId, query);
  }
  @UseGuards(JwtAuthGuard)
  @Post(':id/reading-status')
  @HttpCode(HttpStatus.OK)
  updateReadingStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateReadingStatusDto,
  ) {
    return this.booksService.updateReadingStatus(req.user.userId, id, dto);
  }
  @UseGuards(JwtAuthGuard)
  @Delete(':id/reading-status')
  removeReadingStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.booksService.removeReadingStatus(req.user.userId, id);
  }
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() createBookDto: CreateBookDto): Promise<Book> {
    return this.booksService.create(createBookDto);
  }
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateBookDto: UpdateBookDto,
  ): Promise<Book> {
    return this.booksService.update(id, updateBookDto);
  }
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ message: string }> {
    await this.booksService.remove(id);
    return { message: this.i18n.t('books.deleted') };
  }

  @Get('search')
  search(
    @Query() query: BooksQueryDto,
  ): Promise<PaginatedResult<Book>> {
    if (!query.q || !query.q.trim()) {
      throw new BadRequestException(this.i18n.t('books.empty_search'));
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
  ): Promise<PaginatedResult<Book>> {
    if (type !== 'ebook' && type !== 'audiobook') {
      throw new BadRequestException(
        this.i18n.t('books.invalid_type'),
      );
    }

    return this.booksService.findByType(type, query.page, query.limit);
  }

  @Get('filter')
  filterBooks(
    @Query() query: BooksQueryDto,
  ): Promise<PaginatedResult<Book>> {
    return this.booksService.filterBooks(
      query.page,
      query.limit,
      query.q,
      query.type,
      query.category,
    );
  }

  @Get('categories')
  async getCategoryCounts(
    @Query('format') format?: string,
    @Query('namesOnly') namesOnly?: string,
  ): Promise<string[] | { category: string; count: number }[]> {
    const list = await this.booksService.getCategoryCounts();
    if (format === 'names' || namesOnly === 'true') {
      return list.map((item) => item.category);
    }
    return list;
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Book> {
    return this.booksService.findOne(id);
  }
}
