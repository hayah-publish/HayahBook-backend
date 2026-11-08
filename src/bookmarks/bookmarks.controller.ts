import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BookmarksService } from './bookmarks.service';
import { BookmarksQueryDto } from './dto/bookmarks-query.dto';
import { BookmarkActionDto } from './dto/bookmark-action.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller(['bookmarks', 'saved'])
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  /**
   * GET /v1/bookmarks (or /v1/saved)
   * Paginated feed of saved items with category/tab filters:
   * ?type=all | posts | articles | visuals | snippets
   * (also accepts Arabic names: الكل, المنشورات, المقالات, المرئيات, المقتطفات)
   */
  @Get()
  async getBookmarks(
    @Req() req: AuthenticatedRequest,
    @Query() query: BookmarksQueryDto,
  ) {
    return this.bookmarksService.findAll(req.user.userId, query);
  }

  /**
   * GET /v1/bookmarks/counts (or /v1/saved/counts)
   * Returns item counts across all 5 tabs: { all, posts, articles, visuals, snippets }
   */
  @Get('counts')
  async getCounts(@Req() req: AuthenticatedRequest) {
    return this.bookmarksService.getCounts(req.user.userId);
  }

  /**
   * GET /v1/bookmarks/check/:postId (or /v1/saved/check/:postId)
   * Check if a specific post or article is saved by the current user
   */
  @Get('check/:postId')
  async checkSaved(
    @Req() req: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) postId: string,
  ) {
    return this.bookmarksService.checkSaved(req.user.userId, postId);
  }

  /**
   * POST /v1/bookmarks/:postId (or /v1/saved/:postId)
   * Toggle save/unsave via path parameter
   */
  @Post(':postId')
  @HttpCode(HttpStatus.OK)
  async toggleBookmarkParam(
    @Req() req: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) postId: string,
  ) {
    return this.bookmarksService.toggleBookmark(req.user.userId, postId);
  }

  /**
   * POST /v1/bookmarks (or /v1/saved)
   * Toggle save/unsave via JSON body: { "postId": "..." }
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async toggleBookmarkBody(
    @Req() req: AuthenticatedRequest,
    @Body() body: BookmarkActionDto,
  ) {
    return this.bookmarksService.toggleBookmark(req.user.userId, body.postId);
  }

  /**
   * DELETE /v1/bookmarks/:postId (or /v1/saved/:postId)
   * Explicitly remove a post or article from bookmarks
   */
  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  async removeBookmark(
    @Req() req: AuthenticatedRequest,
    @Param('postId', new ParseUUIDPipe()) postId: string,
  ) {
    return this.bookmarksService.removeBookmark(req.user.userId, postId);
  }
}

