import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthorsService } from './authors.service';
import { FollowMultipleAuthorsDto } from './dto/follow-multiple.dto';
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
@Controller('authors')
export class AuthorsController {
  constructor(
    private readonly authorsService: AuthorsService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * GET /v1/authors
   * GET /v1/authors/suggested
   * Suggests authors ranked by:
   * 1. Shared interests with the user + followers count.
   * 2. Shared interests.
   * 3. Followers count.
   * Displays the top 50 authors if the list has more than 50.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(['', 'suggested'])
  async getSuggestedAuthors(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId;
    const lang = this.i18n.getCurrentLanguage();
    const parsedLimit = limit && !isNaN(parseInt(limit, 10)) ? parseInt(limit, 10) : 50;
    return this.authorsService.getSuggested(userId, lang, parsedLimit);
  }

  /**
   * GET /v1/authors/following
   * GET /v1/authors/me
   * Returns list of authors currently followed by the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get(['following', 'me'])
  async getFollowingAuthors(@Req() req: AuthenticatedRequest) {
    return this.authorsService.getFollowed(req.user!.userId);
  }

  /**
   * POST /v1/authors/follow-multiple
   * POST /v1/authors/follow/batch
   * Follow multiple authors at once (used in onboarding Step 5).
   * Validates >= 5 authors on initial onboarding.
   */
  @UseGuards(JwtAuthGuard)
  @Post(['follow-multiple', 'follow/batch'])
  @HttpCode(HttpStatus.OK)
  async followMultipleAuthors(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FollowMultipleAuthorsDto,
  ) {
    return this.authorsService.followMultiple(req.user!.userId, dto);
  }

  /**
   * POST /v1/authors/:id/toggle-follow
   * Toggles following an author on/off.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle-follow')
  @HttpCode(HttpStatus.OK)
  async toggleFollowAuthor(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.authorsService.toggleFollow(req.user!.userId, id);
  }

  /**
   * POST /v1/authors/:id/follow
   * Toggles following a single author on/off.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  async followAuthor(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body?: { follow?: boolean },
  ) {
    if (body?.follow !== undefined) {
      const existing = await this.authorsService.findById(id, req.user!.userId);
      if (existing.isFollowing === body.follow) {
        return {
          isFollowing: existing.isFollowing,
          message: body.follow
            ? this.i18n.t('authors.already_followed')
            : this.i18n.t('authors.already_not_following'),
          followersCount: existing.followersCount,
          data: {
            targetUserId: id,
            isFollowing: existing.isFollowing,
            followersCount: existing.followersCount,
          },
        };
      }
    }
    const result = await this.authorsService.toggleFollow(req.user!.userId, id);
    return {
      ...result,
      data: {
        targetUserId: id,
        isFollowing: result.isFollowing,
        followersCount: result.followersCount,
      },
    };
  }

  /**
   * DELETE /v1/authors/:id/follow
   * Unfollows a single author.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  async unfollowAuthor(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const author = await this.authorsService.findById(id, req.user!.userId);
    if (!author.isFollowing) {
      return {
        isFollowing: false,
        message: this.i18n.t('authors.already_not_following'),
        followersCount: author.followersCount,
      };
    }
    return this.authorsService.toggleFollow(req.user!.userId, id);
  }

  /**
   * GET /v1/authors/:id
   * Get single author details with `isFollowing` status.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getAuthorById(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.authorsService.findById(id, req.user?.userId);
  }
}

