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
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { UploadFile } from '../upload/upload-file.interface';

interface AuthenticatedRequest extends Request {
  user: {
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
    return this.postsService.createPost(req.user.userId, dto, files);
  }

  /**
   * GET /v1/posts
   * Get paginated posts feed (posts only, excluding articles)
   */
  @Get()
  async getPosts(@Query() query: PostsQueryDto) {
    return this.postsService.findAll({ ...query, type: 'post' });
  }

  /**
   * GET /v1/posts/feed
   * Combined feed for the home screen (posts, articles, visuals, and snippets)
   */
  @Get('feed')
  async getHomeFeed(@Query() query: PostsQueryDto) {
    return this.postsService.getHomeFeed(query);
  }

  /**
   * GET /v1/posts/:id
   * Get a single post by UUID
   */
  @Get(':id')
  async getPostById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.postsService.findOne(id);
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
      req.user.userId,
      req.user.role === 'admin',
      'post',
    );
  }
}
