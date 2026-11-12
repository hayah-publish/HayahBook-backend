import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PostsService } from './posts.service';
import { PostsQueryDto } from './dto/posts-query.dto';
import { ReactPostDto } from './dto/react-post.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { ReportPostDto } from './dto/report-post.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('quotes')
export class QuotesController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * GET /v1/quotes
   * Public feed of all shared quotes from all users.
   * Supports category-based filtering tabs (All, Romantic, Psychological, Motivation, Sadness, etc.).
   * Ordered by createdAt DESC.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getQuotes(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.getQuotesFeed(query, req?.user?.userId);
  }

  /**
   * GET /v1/quotes/categories
   * Get all available quote categories with localized labels and UUIDs.
   */
  @Get('categories')
  async getQuoteCategories(@Query('lang') lang?: string) {
    return this.postsService.getQuoteCategories(lang);
  }

  /**
   * GET /v1/quotes/:id
   * Get single quote by ID.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getQuoteById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findOne(id, req?.user?.userId);
  }

  /**
   * GET /v1/quotes/:id/menu
   * 3-dots actions menu for quote.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/menu')
  async getQuoteMenu(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ) {
    return this.postsService.getPostMenu(id, req?.user?.userId, lang);
  }

  /**
   * POST /v1/quotes/:id/react
   * React to a quote (agree, love, applaud, insightful, disagree).
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/react')
  async reactToQuote(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.postsService.reactToPost(req.user!.userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/quotes/:id/react
   * Remove reaction from a quote.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/react')
  @HttpCode(HttpStatus.OK)
  async removeQuoteReaction(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.removeReaction(req.user!.userId, id);
  }

  /**
   * GET /v1/quotes/:id/reacts
   * Get reactions list for a quote.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/reacts')
  async getQuoteReactions(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }

  /**
   * POST /v1/quotes/:id/share
   * Share quote (increment shares count).
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  async shareQuote(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.postsService.sharePost(id);
  }

  /**
   * PATCH /v1/quotes/:id/toggle-comments
   * Disable / Enable comments on a quote.
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/toggle-comments')
  async toggleComments(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('commentsDisabled') commentsDisabled?: boolean,
  ) {
    return this.postsService.toggleComments(
      id,
      req.user!.userId,
      req.user!.role === 'admin',
      commentsDisabled,
    );
  }

  /**
   * POST /v1/quotes/:id/report
   * Report a quote.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportQuote(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.postsService.reportPost(id, req.user!.userId, dto);
  }

  /**
   * DELETE /v1/quotes/:id
   * Delete a published quote (owner or admin only).
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteQuote(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.remove(
      id,
      req.user!.userId,
      req.user!.role === 'admin',
      'post',
    );
  }
}

