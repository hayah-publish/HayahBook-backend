import {
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
import { UsersService } from './users.service';
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

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * GET /v1/users/me/followers
   * Returns followers of current authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/followers')
  async getMyFollowers(@Req() req: AuthenticatedRequest) {
    return this.usersService.getFollowers(req.user!.userId, req.user!.userId);
  }

  /**
   * GET /v1/users/me/following
   * Returns users currently followed by authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/following')
  async getMyFollowing(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
  ) {
    return this.usersService.getFollowing(
      req.user!.userId,
      req.user!.userId,
      search,
    );
  }

  /**
   * POST /v1/users/:id/toggle-follow
   * Toggles following a user on/off.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle-follow')
  @HttpCode(HttpStatus.OK)
  async toggleFollowUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.toggleFollowUser(req.user!.userId, id);
  }

  /**
   * POST /v1/users/:id/follow
   * Follows a single user.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  async followUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const profile = await this.usersService.getUserPublicProfile(id, req.user!.userId);
    if (profile.isFollowing) {
      return {
        isFollowing: true,
        message: this.i18n.t('users.already_following'),
        followersCount: profile.followersCount,
      };
    }
    return this.usersService.toggleFollowUser(req.user!.userId, id);
  }

  /**
   * DELETE /v1/users/:id/follow
   * Unfollows a user.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  async unfollowUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const profile = await this.usersService.getUserPublicProfile(id, req.user!.userId);
    if (!profile.isFollowing) {
      return {
        isFollowing: false,
        message: this.i18n.t('users.already_not_following'),
        followersCount: profile.followersCount,
      };
    }
    return this.usersService.toggleFollowUser(req.user!.userId, id);
  }

  /**
   * GET /v1/users/:id/followers
   * Returns list of followers of a user.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/followers')
  async getUserFollowers(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.getFollowers(id, req.user?.userId);
  }

  /**
   * GET /v1/users/:id/following
   * Returns list of users followed by a user.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/following')
  async getUserFollowing(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.getFollowing(id, req.user?.userId, search);
  }

  /**
   * GET /v1/users/:id
   * Returns public profile of a user.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getUserProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usersService.getUserPublicProfile(id, req.user?.userId);
  }
}

