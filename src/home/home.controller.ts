import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PostsService } from '../posts/posts.service';
import { PostsQueryDto } from '../posts/dto/posts-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { I18nService } from '../i18n/i18n.service';

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
    return this.postsService.getFeedCounts(filterUserIds);
  }
}
