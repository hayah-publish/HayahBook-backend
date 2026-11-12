import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PostsService } from './posts.service';
import { ReactPostDto } from './dto/react-post.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { I18nService } from '../i18n/i18n.service';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}
@Controller(['reactions', 'react'])
export class ReactionsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * POST /v1/reactions/:id (or /v1/reactions/:id/react)
   * POST /v1/react/:id (or /v1/react/:id/react)
   * Unified reaction endpoint for all 4 types: posts, articles, visuals, and quotes/snippets.
   * Toggles off if the same reaction is clicked again. Switches type if a different reaction is selected.
   */
  @UseGuards(JwtAuthGuard)
  @Post([':id', ':id/react'])
  async reactParam(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.reactToPost(req!.user!.userId, id, dto.reaction);
  }

  /**
   * POST /v1/reactions
   * POST /v1/react
   * Body-based reaction endpoint: { "id": "...", "reaction": "love" }
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async reactBody(
    @Body() dto: ReactPostDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const targetId = dto.id || dto.postId || dto.targetId;
    if (!targetId) {
      throw new BadRequestException(
        this.i18n.t('reactions.target_id_required'),
      );
    }
    return this.postsService.reactToPost(req!.user!.userId, targetId, dto.reaction);
  }

  /**
   * DELETE /v1/reactions/:id (or /v1/reactions/:id/react)
   * DELETE /v1/react/:id (or /v1/react/:id/react)
   * Explicitly remove reaction from any item (post, article, visual, quote/snippet)
   */
  @UseGuards(JwtAuthGuard)
  @Delete([':id', ':id/react'])
  @HttpCode(HttpStatus.OK)
  async removeReaction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.postsService.removeReaction(req!.user!.userId, id);
  }

  /**
   * GET /v1/reactions/:id (or /v1/reactions/:id/reacts)
   * GET /v1/react/:id (or /v1/react/:id/reacts)
   * Get reactions modal list for any item (post, article, visual, quote/snippet) with tabs filtering (all, agree, love, applaud, insightful, disagree)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get([':id', ':id/reacts'])
  async getReactions(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }
}

