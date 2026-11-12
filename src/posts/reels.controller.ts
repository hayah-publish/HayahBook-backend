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
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { PostsService } from './posts.service';
import { PostsQueryDto } from './dto/posts-query.dto';
import { CreateVisualDto } from './dto/create-visual.dto';
import { ReactPostDto } from './dto/react-post.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { UploadFile } from '../upload/upload-file.interface';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('reels')
export class ReelsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * GET /v1/reels
   * Dedicated Reels discovery feed.
   * Strictly filters for vertical reels (type = 'visual').
   * Powered by a smart recommendation algorithm:
   * - Boost for user interests (50 points)
   * - Priority for followed creators (40 points)
   * - Engagement weighting: likes * 3, comments * 5, shares * 7, bookmarks * 4, reads * 0.1
   * - Freshness/recency decay
   * - Social proof ("Followed by X and Y others")
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getReels(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.getReelsFeed(query, req?.user?.userId);
  }

  /**
   * POST /v1/reels
   * Publish a reel video post.
   * Requirements:
   * - Type is 'visual'.
   * - Video aspect ratio must be vertical 9:16.
   * - Exactly ONE video only (max 500MB).
   * - User mentions and links supported.
   * - Book mentions strictly limited to ONE book.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 500 * 1024 * 1024,
        files: 5,
      },
    }),
  )
  async createReel(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateVisualDto,
    @UploadedFiles() files?: UploadFile[],
  ) {
    return this.postsService.createVisual(req.user!.userId, dto, files);
  }

  /**
   * GET /v1/reels/:id
   * Get single reel by ID.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getReelById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findOne(id, req?.user?.userId);
  }

  /**
   * GET /v1/reels/:id/menu
   * 3-dots actions menu for reel.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/menu')
  async getReelMenu(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ) {
    return this.postsService.getPostMenu(id, req?.user?.userId, lang);
  }

  /**
   * POST /v1/reels/:id/react (or /v1/reels/:id/reaction)
   * React to reel (agree, love, applaud, insightful, disagree).
   */
  @UseGuards(JwtAuthGuard)
  @Post([':id/react', ':id/reaction'])
  async reactToReel(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.postsService.reactToPost(req.user!.userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/reels/:id/react (or /v1/reels/:id/reaction)
   * Remove reaction from reel.
   */
  @UseGuards(JwtAuthGuard)
  @Delete([':id/react', ':id/reaction'])
  @HttpCode(HttpStatus.OK)
  async removeReelReaction(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.removeReaction(req.user!.userId, id);
  }

  /**
   * GET /v1/reels/:id/reacts (or /v1/reels/:id/reactions)
   * Get reactions list for reel.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get([':id/reacts', ':id/reactions'])
  async getReelReactions(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }

  /**
   * POST /v1/reels/:id/share
   * Share reel.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  async shareReel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.postsService.sharePost(id);
  }

  /**
   * PATCH /v1/reels/:id/toggle-comments
   * Disable / Enable comments on reel.
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
   * POST /v1/reels/:id/report
   * Report reel.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportReel(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.postsService.reportPost(id, req.user!.userId, dto);
  }

  /**
   * DELETE /v1/reels/:id
   * Delete reel (owner or admin only).
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteReel(
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
