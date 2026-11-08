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

@Controller('categories')
export class CategoriesController {
  constructor(private readonly interestsService: InterestsService) {}

  /**
   * GET /v1/categories/articles
   * Returns the 9 article categories matching the mobile/web design:
   * Current events, History and heritage, Culture and arts, Knowledge and education,
   * Business and skills, Self development, Society and life, Free articles, Travel and places.
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

