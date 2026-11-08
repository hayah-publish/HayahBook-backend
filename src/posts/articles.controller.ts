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
import { CreateArticleDto } from './dto/create-article.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { ReactPostDto } from './dto/react-post.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { UploadFile } from '../upload/upload-file.interface';
import { InterestsService } from '../interests/interests.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly postsService: PostsService,
    private readonly interestsService: InterestsService,
  ) {}

  /**
   * GET /v1/articles/categories
   * Dedicated endpoint returning the 9 article categories
   */
  @Get('categories')
  async getCategories() {
    return this.interestsService.getArticleCategories();
  }

  /**
   * POST /v1/articles
   * Create & Publish an article with strict validations:
   * Title, cover image, category, and content are strictly REQUIRED.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 500 * 1024 * 1024,
        files: 12,
      },
    }),
  )
  async createArticle(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateArticleDto,
    @UploadedFiles() files?: UploadFile[],
  ) {
    return this.postsService.createArticle(req.user!.userId, dto, files);
  }

  /**
   * GET /v1/articles
   * Paginated feed of articles only
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getArticles(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findAll(
      Object.assign(query, { type: 'article' as const }),
      req?.user?.userId,
    );
  }

  /**
   * GET /v1/articles/:id
   * Get single article by ID
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getArticleById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findOne(id, req?.user?.userId);
  }

  /**
   * POST /v1/articles/:id/react
   * React to article (agree, love, applaud, insightful, disagree)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/react')
  async reactToArticle(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.postsService.reactToPost(req!.user!.userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/articles/:id/react
   * Explicitly remove reaction from an article
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/react')
  @HttpCode(HttpStatus.OK)
  async removeArticleReaction(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.removeReaction(req!.user!.userId, id);
  }

  /**
   * GET /v1/articles/:id/reacts
   * Get reactions modal list with tabs filtering (all, agree, love, applaud, insightful, disagree)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/reacts')
  async getArticleReactions(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }

  /**
   * DELETE /v1/articles/:id
   * Delete an article and purge its cover and media
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteArticle(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.remove(
      id,
      req.user!.userId,
      req.user!.role === 'admin',
      'article',
    );
  }
}

