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
import { CreateArticleDto } from './dto/create-article.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { UploadFile } from '../upload/upload-file.interface';
import { InterestsService } from '../interests/interests.service';

interface AuthenticatedRequest extends Request {
  user: {
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
    return this.postsService.createArticle(req.user.userId, dto, files);
  }

  /**
   * GET /v1/articles
   * Paginated feed of articles only
   */
  @Get()
  async getArticles(@Query() query: PostsQueryDto) {
    return this.postsService.findAll({ ...query, type: 'article' });
  }

  /**
   * GET /v1/articles/:id
   * Get single article by ID
   */
  @Get(':id')
  async getArticleById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.postsService.findOne(id);
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
      req.user.userId,
      req.user.role === 'admin',
    );
  }
}

