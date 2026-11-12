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
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { I18nService } from '../i18n/i18n.service';
import { FollowStateDto } from './dto/follow-state.dto';

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
   * Toggles following a user on/off (or sets explicit state via body { follow: boolean }).
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/follow')
  @HttpCode(HttpStatus.OK)
  async followUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body?: FollowStateDto,
  ) {
    const result = await this.usersService.toggleFollowUser(
      req.user!.userId,
      id,
      body?.follow,
    );
    return {
      message: result.message,
      isFollowing: result.isFollowing,
      followersCount: result.followersCount,
      data: {
        targetUserId: id,
        isFollowing: result.isFollowing,
        followersCount: result.followersCount,
      },
    };
  }

  /** Unfollows a user; repeated requests keep the relation inactive. */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/follow')
  @HttpCode(HttpStatus.OK)
  async unfollowUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.usersService.toggleFollowUser(
      req.user!.userId,
      id,
      false,
    );
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
   * POST /v1/users/:id/block
   * Blocks a user and removes mutual follows.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  async blockUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.usersService.blockUser(req.user!.userId, id);
    return {
      message: result.message,
      isBlocked: result.isBlocked,
      blockedUser: result.blockedUser,
      data: {
        targetUserId: id,
        isBlocked: result.isBlocked,
        blockedUser: result.blockedUser,
      },
    };
  }

  /**
   * DELETE /v1/users/:id/block
   * Unblocks a user.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/block')
  @HttpCode(HttpStatus.OK)
  async unblockUser(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.usersService.unblockUser(req.user!.userId, id);
    return {
      message: result.message,
      isBlocked: result.isBlocked,
      data: {
        targetUserId: id,
        isBlocked: result.isBlocked,
      },
    };
  }

  /**
   * GET /v1/users/me/blocks (or /v1/users/me/blocked)
   * Returns list of users blocked by the authenticated user.
   */
  @UseGuards(JwtAuthGuard)
  @Get(['me/blocks', 'me/blocked'])
  async getMyBlocks(@Req() req: AuthenticatedRequest) {
    const result = await this.usersService.getBlockedUsers(req.user!.userId);
    return {
      data: result,
    };
  }
  @UseGuards(JwtAuthGuard)
  @Get('me/followers/page')
  async getMyFollowersPage(
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getFollowersPage(
      req.user!.userId,
      req.user!.userId,
      Number(page),
      Number(limit),
    );
  }
  @UseGuards(JwtAuthGuard)
  @Get('me/following/page')
  async getMyFollowingPage(
    @Req() req: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getFollowingPage(
      req.user!.userId,
      req.user!.userId,
      search,
      Number(page),
      Number(limit),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/followers/page')
  async getUserFollowersPage(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getFollowersPage(
      id,
      req.user?.userId,
      Number(page),
      Number(limit),
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/following/page')
  async getUserFollowingPage(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getFollowingPage(
      id,
      req.user?.userId,
      search,
      Number(page),
      Number(limit),
    );
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
