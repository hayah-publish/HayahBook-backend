import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PostsService } from '../posts/posts.service';
import { PostsQueryDto } from '../posts/dto/posts-query.dto';
import { ReactPostDto } from '../posts/dto/react-post.dto';
import { ReactionsQueryDto } from '../posts/dto/reactions-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}
@Controller(['home', 'feed'])
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(
    private readonly postsService: PostsService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * GET /v1/home
   * GET /v1/feed
   * Unified Home Feed combining posts, articles, visuals, and snippets.
   * Strictly requires Bearer Token (no unregistered guests allowed).
   * Query params:
   *  - type: all | posts | articles | visuals | snippets
   *  - following: true | false (filter to followed accounts)
   *  - scope: all | following
   */
  @Get()
  async getHomeFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    return this.postsService.getHomeFeed(query, userId);
  }

  /**
   * GET /v1/home/following
   * GET /v1/feed/following
   * Dedicated endpoint for followed accounts across all 4 types (posts, articles, visuals, snippets)
   */
  @Get('following')
  async getFollowingFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    return this.postsService.getHomeFeed(
      Object.assign(query, { following: true, scope: 'following' as const }),
      userId,
    );
  }

  /**
   * GET /v1/home/feed
   */
  @Get('feed')
  async getFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    return this.postsService.getHomeFeed(query, userId);
  }

  /**
   * GET /v1/home/counts
   * GET /v1/feed/counts
   * Item counts for all 5 feed tabs (all, posts, articles, visuals, snippets)
   * Supports ?following=true to get counts for followed accounts
   */
  @Get('counts')
  async getFeedCounts(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    const isFollowing = query.following === true || query.scope === 'following';
    const filterUserIds = isFollowing
      ? await this.postsService.getFollowedUserIds(userId)
      : undefined;
    const hasTaxonomyFilter = Boolean(query.category || query.subcategory || query.topic);
    return hasTaxonomyFilter
      ? this.postsService.getFeedCounts(filterUserIds, query)
      : this.postsService.getFeedCounts(filterUserIds);
  }

  /**
   * GET /v1/home/filters
   * GET /v1/feed/filters
   * GET /v1/home/categories
   * GET /v1/feed/categories
   * Hierarchical categories and subcategories taxonomy for the Home Feed filter bottom sheet
   */
  @Get(['filters', 'categories'])
  async getHomeFilters(@Query('lang') lang?: string, @Req() req?: any) {
    const headerLang = req?.headers?.['accept-language'];
    const currentLang = (lang || (headerLang?.includes('en') ? 'en' : 'ar')) as SupportedLanguage;
    return this.postsService.getHomeFilters(currentLang);
  }

  /**
   * POST /v1/home/:id/react
   * POST /v1/feed/:id/react
   * React to any feed item (posts, articles, visuals, snippets)
   */
  @Post(':id/react')
  async reactToFeedItem(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    return this.postsService.reactToPost(userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/home/:id/react
   * DELETE /v1/feed/:id/react
   * Remove reaction from any feed item (posts, articles, visuals, snippets)
   */
  @Delete(':id/react')
  @HttpCode(HttpStatus.OK)
  async removeFeedItemReaction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    return this.postsService.removeReaction(userId, id);
  }

  /**
   * GET /v1/home/:id/reacts
   * GET /v1/feed/:id/reacts
   * Get reactions modal list for any feed item
   */
  @Get(':id/reacts')
  async getFeedItemReactions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.userId;
    return this.postsService.getPostReactions(id, query, userId);
  }
}
