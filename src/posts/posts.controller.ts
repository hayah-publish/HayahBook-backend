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
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { ReactPostDto } from './dto/react-post.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { UploadFile } from '../upload/upload-file.interface';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * POST /v1/posts
   * Create and publish a post with direct atomic media upload (images and/or video)
   * Ensures media is ONLY uploaded to Cloudflare R2 when the user actually publishes the post.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 500 * 1024 * 1024,
        files: 20,
      },
    }),
  )
  async createPost(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePostDto,
    @UploadedFiles() files?: UploadFile[],
  ) {
    return this.postsService.createPost(req.user!.userId, dto, files);
  }

  /**
   * GET /v1/posts
   * Get paginated posts feed (posts only, excluding articles)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getPosts(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findAll(
      Object.assign(query, { type: 'post' as const }),
      req?.user?.userId,
    );
  }

  /**
   * GET /v1/posts/feed
   * Combined feed for the home screen (posts, articles, visuals, and snippets)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('feed')
  async getHomeFeed(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.getHomeFeed(query, req?.user?.userId);
  }

  /**
   * GET /v1/posts/report-reasons (or /v1/posts/reports/reasons)
   * Get post report reasons with standard 8 UUIDs
   */
  @Get(['report-reasons', 'reports/reasons'])
  async getReportReasons(
    @Query('lang') lang?: string,
    @Query('meta') meta?: string,
  ) {
    const reasons = await this.postsService.getReportReasons(
      lang,
      meta === 'true',
    );
    return {
      data: reasons,
      ...(typeof reasons === 'object' && !Array.isArray(reasons)
        ? reasons
        : {}),
    };
  }

  /**
   * GET /v1/posts/:id/menu (or /v1/posts/:id/options)
   * Returns tailored 3-dots actions menu matching the Figma designs
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get([':id/menu', ':id/options'])
  async getPostMenu(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ) {
    const menu = await this.postsService.getPostMenu(
      id,
      req?.user?.userId,
      lang,
    );
    return {
      data: menu,
      ...menu,
    };
  }

  /**
   * GET /v1/posts/:id
   * Get a single post by UUID
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getPostById(
    @Param('id') id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const post = await this.postsService.findOne(id, req?.user?.userId);
    return {
      data: post,
      ...post,
    };
  }

  /**
   * PATCH /v1/posts/:id
   * Edit post content, title, category, media (Owner or admin only)
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 500 * 1024 * 1024,
        files: 20,
      },
    }),
  )
  async updatePost(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostDto,
    @UploadedFiles() files?: UploadFile[],
  ) {
    return this.postsService.updatePost(
      id,
      req.user!.userId,
      dto,
      files,
      req.user!.role === 'admin',
    );
  }

  /**
   * PATCH /v1/posts/:id/toggle-comments (or /v1/posts/:id/comments-status)
   * Disable or enable comments on post (Owner or admin only)
   */
  @UseGuards(JwtAuthGuard)
  @Patch([':id/toggle-comments', ':id/comments-status'])
  async toggleComments(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('commentsDisabled') commentsDisabled?: boolean,
  ) {
    const result = await this.postsService.toggleComments(
      id,
      req.user!.userId,
      req.user!.role === 'admin',
      commentsDisabled,
    );
    return {
      message: result.message,
      commentsDisabled: result.commentsDisabled,
      data: {
        postId: id,
        commentsDisabled: result.commentsDisabled,
      },
    };
  }

  /**
   * POST /v1/posts/:id/view-less (or /v1/posts/:id/hide)
   * Toggle view less on/off from caller's feed (or set explicit state via body { hidden: boolean })
   */
  @UseGuards(JwtAuthGuard)
  @Post([':id/view-less', ':id/hide'])
  @HttpCode(HttpStatus.OK)
  async viewLessPost(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body?: { hidden?: boolean },
  ) {
    const result = await this.postsService.viewLessPost(
      id,
      req.user!.userId,
      body?.hidden,
    );
    return {
      message: result.message,
      isHidden: result.isHidden,
      data: {
        postId: id,
        isHidden: result.isHidden,
      },
    };
  }

  /**
   * DELETE /v1/posts/:id/view-less (or /v1/posts/:id/hide)
   * Undo view less
   */
  @UseGuards(JwtAuthGuard)
  @Delete([':id/view-less', ':id/hide'])
  @HttpCode(HttpStatus.OK)
  async unviewLessPost(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.postsService.unviewLessPost(id, req.user!.userId);
    return {
      message: result.message,
      isHidden: result.isHidden,
      data: {
        postId: id,
        isHidden: result.isHidden,
      },
    };
  }

  /**
   * POST /v1/posts/:id/share
   * Share post, increment shares count, return web share URL
   * AUTH: Optional / Public
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  async sharePost(@Param('id') id: string) {
    const result = await this.postsService.sharePost(id);
    return {
      message: result.message,
      sharesCount: result.sharesCount,
      shareUrl: result.shareUrl,
      data: result.data,
    };
  }

  /**
   * POST /v1/posts/:id/report
   * Report post with reason / reasonId and details
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportPost(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportPostDto,
  ) {
    const result = await this.postsService.reportPost(
      id,
      req.user!.userId,
      dto,
    );
    return {
      message: result.message,
      report: result.report,
      confirmation: result.confirmation,
      data: {
        ...result.report,
        confirmation: result.confirmation,
      },
    };
  }

  /**
   * POST /v1/posts/:id/react
   * React to post (agree, love, applaud, insightful, disagree).
   * Toggles off if the same reaction is clicked again. Switches type if a different reaction is selected.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/react')
  async reactToPost(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.reactToPost(req!.user!.userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/posts/:id/react
   * Explicitly remove reaction from a post
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/react')
  @HttpCode(HttpStatus.OK)
  async removeReaction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.removeReaction(req!.user!.userId, id);
  }

  /**
   * GET /v1/posts/:id/reacts
   * Get reactions modal list with tabs filtering (all, agree, love, applaud, insightful, disagree)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/reacts')
  async getPostReactions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }

  /**
   * DELETE /v1/posts/:id
   * Delete a post (owner or admin only) and purge its media (images and video) from Cloudflare R2
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.postsService.remove(
      id,
      req.user!.userId,
      req.user!.role === 'admin',
      'post',
    );
    return {
      message: result.message,
      data: {
        postId: id,
        deleted: true,
      },
    };
  }
}
