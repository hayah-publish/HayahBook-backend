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

@Controller('visuals')
export class VisualsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * GET /v1/visuals
   * Paginated feed of visual posts and videos.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getVisuals(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findAll(
      Object.assign(query, { type: 'visuals' as const }),
      req?.user?.userId,
    );
  }

  /**
   * GET /v1/visuals/:id
   * Get single visual post by ID.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getVisualById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findOne(id, req?.user?.userId);
  }

  /**
   * GET /v1/visuals/:id/menu
   * 3-dots actions menu for visual post.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/menu')
  async getVisualMenu(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ) {
    return this.postsService.getPostMenu(id, req?.user?.userId, lang);
  }

  /**
   * POST /v1/visuals/:id/react (or /v1/visuals/:id/reaction)
   * React to visual post (agree, love, applaud, insightful, disagree).
   */
  @UseGuards(JwtAuthGuard)
  @Post([':id/react', ':id/reaction'])
  async reactToVisual(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.postsService.reactToPost(req.user!.userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/visuals/:id/react (or /v1/visuals/:id/reaction)
   * Remove reaction from visual post.
   */
  @UseGuards(JwtAuthGuard)
  @Delete([':id/react', ':id/reaction'])
  @HttpCode(HttpStatus.OK)
  async removeVisualReaction(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.removeReaction(req.user!.userId, id);
  }

  /**
   * GET /v1/visuals/:id/reacts (or /v1/visuals/:id/reactions)
   * Get reactions list for visual post.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get([':id/reacts', ':id/reactions'])
  async getVisualReactions(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }

  /**
   * POST /v1/visuals/:id/share
   * Share visual post.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  async shareVisual(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.postsService.sharePost(id);
  }

  /**
   * PATCH /v1/visuals/:id/toggle-comments
   * Disable / Enable comments on visual post.
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
   * POST /v1/visuals/:id/report
   * Report visual post.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportVisual(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.postsService.reportPost(id, req.user!.userId, dto);
  }

  /**
   * DELETE /v1/visuals/:id
   * Delete visual post (owner or admin only).
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteVisual(
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

