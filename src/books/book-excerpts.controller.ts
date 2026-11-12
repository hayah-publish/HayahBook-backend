import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookExcerptsService } from './book-excerpts.service';
import { PostsService } from '../posts/posts.service';
import { CreateExcerptDto } from './dto/create-excerpt.dto';
import { UpdateExcerptDto } from './dto/update-excerpt.dto';
import { ShareExcerptDto } from './dto/share-excerpt.dto';
import { ExcerptsQueryDto } from './dto/excerpts-query.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BookExcerptsController {
  constructor(
    private readonly excerptsService: BookExcerptsService,
    private readonly postsService: PostsService,
  ) {}

  /**
   * POST /v1/books/excerpts/:id/share (or /v1/books/quotes/:id/share)
   * Share an excerpt to the user's public profile as a snippet.
   */
  @Post(['excerpts/:id/share', 'quotes/:id/share'])
  @HttpCode(HttpStatus.CREATED)
  async shareExcerptToProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ShareExcerptDto,
  ) {
    return this.postsService.createSnippet(req.user.userId, {
      excerptId: id,
      content: dto.content,
      showBookDetails: dto.showBookDetails,
    });
  }

  /**
   * GET /v1/books/excerpts/my (or /v1/books/quotes/my)
   * Get all books where caller has saved excerpts, grouped by book with count.
   */
  @Get(['excerpts/my', 'quotes/my'])
  async getMyBooksWithExcerpts(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.excerptsService.getMyBooksWithExcerpts(req.user.userId, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * GET /v1/books/excerpts/:id (or /v1/books/quotes/:id)
   * Get a single excerpt by ID (strictly private to owner).
   */
  @Get(['excerpts/:id', 'quotes/:id'])
  async getExcerptById(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const excerpt = await this.excerptsService.getExcerptById(
      req.user.userId,
      id,
    );
    return { data: excerpt };
  }

  /**
   * PATCH /v1/books/excerpts/:id (or /v1/books/quotes/:id)
   * Update an excerpt (note, pageNumber, chapter, content, cfiRange).
   */
  @Patch(['excerpts/:id', 'quotes/:id'])
  @HttpCode(HttpStatus.OK)
  async updateExcerpt(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExcerptDto,
  ) {
    return this.excerptsService.updateExcerpt(req.user.userId, id, dto);
  }

  /**
   * DELETE /v1/books/excerpts/:id (or /v1/books/quotes/:id)
   * Delete an excerpt (strictly private to owner).
   */
  @Delete(['excerpts/:id', 'quotes/:id'])
  @HttpCode(HttpStatus.OK)
  async deleteExcerpt(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.excerptsService.deleteExcerpt(req.user.userId, id);
  }

  /**
   * POST /v1/books/:bookId/excerpts (or /v1/books/:bookId/quotes)
   * Save a new excerpt/quotation from a book.
   */
  @Post([':bookId/excerpts', ':bookId/quotes'])
  @HttpCode(HttpStatus.CREATED)
  async createExcerpt(
    @Req() req: AuthenticatedRequest,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Body() dto: CreateExcerptDto,
  ) {
    return this.excerptsService.createExcerpt(req.user.userId, bookId, dto);
  }

  /**
   * GET /v1/books/:bookId/excerpts (or /v1/books/:bookId/quotes)
   * List all excerpts saved by current user for this specific book.
   */
  @Get([':bookId/excerpts', ':bookId/quotes'])
  async getExcerptsForBook(
    @Req() req: AuthenticatedRequest,
    @Param('bookId', new ParseUUIDPipe()) bookId: string,
    @Query() query: ExcerptsQueryDto,
  ) {
    return this.excerptsService.getExcerptsForBook(
      req.user.userId,
      bookId,
      query,
    );
  }
}

/**
 * Direct top-level controller for /v1/excerpts and /v1/quotes
 */
@Controller(['excerpts', 'quotes'])
@UseGuards(JwtAuthGuard)
export class DirectExcerptsController {
  constructor(
    private readonly excerptsService: BookExcerptsService,
    private readonly postsService: PostsService,
  ) {}

  @Post(':id/share')
  @HttpCode(HttpStatus.CREATED)
  async shareExcerptToProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ShareExcerptDto,
  ) {
    return this.postsService.createSnippet(req.user.userId, {
      excerptId: id,
      content: dto.content,
      showBookDetails: dto.showBookDetails,
    });
  }

  @Get('my')
  async getMyBooksWithExcerpts(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.excerptsService.getMyBooksWithExcerpts(req.user.userId, {
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  async getExcerptById(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const excerpt = await this.excerptsService.getExcerptById(
      req.user.userId,
      id,
    );
    return { data: excerpt };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateExcerpt(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExcerptDto,
  ) {
    return this.excerptsService.updateExcerpt(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteExcerpt(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.excerptsService.deleteExcerpt(req.user.userId, id);
  }
}
