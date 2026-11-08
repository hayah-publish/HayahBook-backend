import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { InterestsService } from './interests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Dedicated Controller specifically for:
 * GET /v1/articles/categories
 * Returns the exact 9 article categories in sorted order.
 */
@Controller('articles/categories')
export class ArticlesCategoriesController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  async getCategories() {
    return this.interestsService.getArticleCategories();
  }

  @UseGuards(JwtAuthGuard)
  @Post(['save', 'select'])
  @HttpCode(HttpStatus.OK)
  async saveCategory(
    @Req() req: AuthenticatedRequest,
    @Body() body: { categoryId?: string; category?: string },
  ) {
    return this.interestsService.saveSingleCategory(
      req.user.userId,
      body.categoryId || body.category,
    );
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly interestsService: InterestsService) {}

  /**
   * GET /v1/categories/articles
   */
  @Get('articles')
  async getArticleCategories() {
    return this.interestsService.getArticleCategories();
  }

  /**
   * GET /v1/categories
   * When queried with ?type=article or ?category=articles, returns the 9 article categories.
   * Otherwise returns all categories grouped with counts.
   */
  @Get()
  async getCategories(
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    const target = type || category;
    if (target) {
      return this.interestsService.findAll({ category: target });
    }
    return this.interestsService.getCategoriesSummary();
  }

  /**
   * GET /v1/categories/:category
   */
  @Get(':category')
  async getByCategory(@Param('category') category: string) {
    return this.interestsService.findAll({ category });
  }

  /**
   * POST /v1/categories/save
   */
  @UseGuards(JwtAuthGuard)
  @Post(['save', 'select'])
  @HttpCode(HttpStatus.OK)
  async saveCategory(
    @Req() req: AuthenticatedRequest,
    @Body() body: { categoryId?: string; category?: string },
  ) {
    return this.interestsService.saveSingleCategory(
      req.user.userId,
      body.categoryId || body.category,
    );
  }
}

