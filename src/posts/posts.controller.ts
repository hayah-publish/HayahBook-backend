import {
  Controller,
  Get,
  Post,
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
  constructor(
    private readonly postsService: PostsService,
  ) {}

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
    return this.postsService.findAll({ ...query, type: 'post' }, req?.user?.userId);
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
   * GET /v1/posts/:id
   * Get a single post by UUID
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getPostById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findOne(id, req?.user?.userId);
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
    return this.postsService.remove(
      id,
      req.user!.userId,
      req.user!.role === 'admin',
      'post',
    );
  }
}
