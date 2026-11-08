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
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { BooksService, PaginatedResult } from './books.service';
import { Audiobook } from './audiobook.entity';
import { CreateAudiobookDto } from './dto/create-audiobook.dto';
import { UpdateAudiobookDto } from './dto/update-audiobook.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { I18nService } from '../i18n/i18n.service';

@Controller('audiobooks')
export class AudiobooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: string,
    @Query('q') query?: string,
  ): Promise<PaginatedResult<Audiobook>> {
    return this.booksService.findAllAudiobooks(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      category,
      query,
    );
  }

  @Get('latest')
  getLatest(
    @Query('limit') limit?: number,
  ): Promise<PaginatedResult<Audiobook>> {
    return this.booksService.findLatestAudiobooks(
      limit ? Number(limit) : 20,
    );
  }

  @Get('search')
  search(
    @Query('q') query: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResult<Audiobook>> {
    if (!query || !query.trim()) {
      throw new BadRequestException(this.i18n.t('books.empty_search'));
    }

    return this.booksService.searchAudiobooks(
      query.trim(),
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('categories')
  async getCategories(
    @Query('format') format?: string,
    @Query('namesOnly') namesOnly?: string,
  ): Promise<string[] | { category: string; count: number }[]> {
    const list = await this.booksService.getAudiobookCategoryCounts();
    if (format === 'names' || namesOnly === 'true') {
      return list.map((item) => item.category);
    }
    return list;
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Audiobook> {
    return this.booksService.findOneAudiobook(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  create(@Body() dto: CreateAudiobookDto): Promise<Audiobook> {
    return this.booksService.createAudiobook(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAudiobookDto,
  ): Promise<Audiobook> {
    return this.booksService.updateAudiobook(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ message: string }> {
    await this.booksService.removeAudiobook(id);
    return { message: this.i18n.t('audiobooks.deleted') };
  }
}
