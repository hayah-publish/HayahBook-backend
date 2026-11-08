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
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { I18nService } from '../i18n/i18n.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller(['home', 'feed'])
export class HomeController {
  constructor(
    private readonly postsService: PostsService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * GET /v1/home
   * GET /v1/feed
   * Unified Home Feed combining posts, articles, visuals, and snippets.
   * Query params:
   *  - type: all | posts | articles | visuals | snippets
   *  - following: true | false (filter to followed accounts)
   *  - scope: all | following
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getHomeFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    return this.postsService.getHomeFeed(query, req.user?.userId);
  }

  /**
   * GET /v1/home/following
   * GET /v1/feed/following
   * Dedicated endpoint for followed accounts across all 4 types (posts, articles, visuals, snippets)
   */
  @Get('following')
  @UseGuards(JwtAuthGuard)
  async getFollowingFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    return this.postsService.getHomeFeed(
      Object.assign(query, { following: true, scope: 'following' as const }),
      req.user!.userId,
    );
  }

  /**
   * GET /v1/home/feed
   */
  @Get('feed')
  @UseGuards(OptionalJwtAuthGuard)
  async getFeed(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    return this.postsService.getHomeFeed(query, req.user?.userId);
  }

  /**
   * GET /v1/home/counts
   * GET /v1/feed/counts
   * Item counts for all 5 feed tabs (all, posts, articles, visuals, snippets)
   * Supports ?following=true to get counts for followed accounts
   */
  @Get('counts')
  @UseGuards(OptionalJwtAuthGuard)
  async getFeedCounts(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    const userId = req.user?.userId;
    const isFollowing = query.following === true || query.scope === 'following';
    if (isFollowing && !userId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }
    const filterUserIds = isFollowing && userId
      ? await this.postsService.getFollowedUserIds(userId)
      : undefined;
    return this.postsService.getFeedCounts(filterUserIds);
  }
}
