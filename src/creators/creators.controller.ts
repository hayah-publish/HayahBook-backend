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
import { CreatorsService } from './creators.service';
import { FollowMultipleCreatorsDto } from './dto/follow-multiple-creators.dto';
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
@Controller('creators')
export class CreatorsController {
  constructor(
    private readonly creatorsService: CreatorsService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * GET /v1/creators
   * GET /v1/creators/suggested
   * Suggests content creators ranked by:
   * 1. Shared interests with the user + followers count.
   * 2. Shared interests.
   * 3. Followers count.
   * Displays the top 50 creators by default.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(['', 'suggested'])
  async getSuggestedCreators(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    const userId = req.user?.userId;
    const lang = this.i18n.getCurrentLanguage();
    const parsedLimit = limit && !isNaN(parseInt(limit, 10)) ? parseInt(limit, 10) : 50;
    return this.creatorsService.getSuggested(userId, lang, parsedLimit);
  }

  /**
   * GET /v1/creators/following
   * GET /v1/creators/me
   * Returns list of content creators currently followed by the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get(['following', 'me'])
  async getFollowingCreators(@Req() req: AuthenticatedRequest) {
    return this.creatorsService.getFollowed(req.user!.userId);
  }

  /**
   * POST /v1/creators/follow-multiple
   * POST /v1/creators/follow/batch
   * Follow multiple content creators at once (used in onboarding Step 6).
   * Validates >= 3 creators on initial onboarding.
   */
  @UseGuards(JwtAuthGuard)
  @Post(['follow-multiple', 'follow/batch'])
  @HttpCode(HttpStatus.OK)
  async followMultipleCreators(
    @Req() req: AuthenticatedRequest,
    @Body() dto: FollowMultipleCreatorsDto,
  ) {
    return this.creatorsService.followMultiple(req.user!.userId, dto);
  }

  /**
   * POST /v1/creators/:id/toggle-follow
   * Toggles following a content creator on/off.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle-follow')
  @HttpCode(HttpStatus.OK)
  async toggleFollowCreator(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.creatorsService.toggleFollow(req.user!.userId, id);
  }

  /**
   * POST /v1/creators/:id/follow
   * Follows a single content creator.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  async followCreator(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const existing = await this.creatorsService.findById(id, req.user!.userId);
    if (existing.isFollowing) {
      return {
        isFollowing: true,
        message: this.i18n.t('creators.already_followed'),
        followersCount: existing.followersCount,
      };
    }
    return this.creatorsService.toggleFollow(req.user!.userId, id);
  }

  /**
   * DELETE /v1/creators/:id/follow
   * Unfollows a single content creator.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  async unfollowCreator(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const creator = await this.creatorsService.findById(id, req.user!.userId);
    if (!creator.isFollowing) {
      return {
        isFollowing: false,
        message: this.i18n.t('creators.already_not_following'),
        followersCount: creator.followersCount,
      };
    }
    return this.creatorsService.toggleFollow(req.user!.userId, id);
  }

  /**
   * GET /v1/creators/:id
   * Get single creator details with `isFollowing` status.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getCreatorById(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.creatorsService.findById(id, req.user?.userId);
  }
}

