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
import { CreateSnippetDto } from './dto/create-snippet.dto';
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

@Controller('snippets')
export class SnippetsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * POST /v1/snippets
   * Publish a snippet to the user's public profile.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSnippet(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSnippetDto,
  ) {
    return this.postsService.createSnippet(req.user!.userId, dto);
  }

  /**
   * GET /v1/snippets
   * Paginated feed of publicly published snippets ordered by addition date.
   * Can be filtered by `userId` to load snippets for a user profile.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getSnippets(
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findAll(
      Object.assign(query, { type: 'snippet' as const }),
      req?.user?.userId,
    );
  }

  /**
   * GET /v1/snippets/my
   * Get all snippets published by current user on their profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMySnippets(
    @Req() req: AuthenticatedRequest,
    @Query() query: PostsQueryDto,
  ) {
    return this.postsService.findAll(
      Object.assign(query, {
        type: 'snippet' as const,
        userId: req.user!.userId,
      }),
      req.user!.userId,
    );
  }

  /**
   * GET /v1/snippets/user/:userId
   * Get all publicly published snippets for a specific user (profile snippets tab).
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('user/:userId')
  async getUserSnippets(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Query() query: PostsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findAll(
      Object.assign(query, {
        type: 'snippet' as const,
        userId,
      }),
      req?.user?.userId,
    );
  }

  /**
   * GET /v1/snippets/:id
   * Get single published snippet by ID.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getSnippetById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.postsService.findOne(id, req?.user?.userId);
  }

  /**
   * GET /v1/snippets/:id/menu
   * 3-dots actions menu for snippet.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/menu')
  async getSnippetMenu(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req?: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ) {
    return this.postsService.getPostMenu(id, req?.user?.userId, lang);
  }

  /**
   * POST /v1/snippets/:id/react
   * React to snippet (agree, love, applaud, insightful, disagree).
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/react')
  async reactToSnippet(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactPostDto,
  ) {
    return this.postsService.reactToPost(req.user!.userId, id, dto.reaction);
  }

  /**
   * DELETE /v1/snippets/:id/react
   * Remove reaction from snippet.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/react')
  @HttpCode(HttpStatus.OK)
  async removeSnippetReaction(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.removeReaction(req.user!.userId, id);
  }

  /**
   * GET /v1/snippets/:id/reacts
   * Get reactions list for snippet.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/reacts')
  async getSnippetReactions(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: ReactionsQueryDto,
  ) {
    return this.postsService.getPostReactions(id, query, req?.user?.userId);
  }

  /**
   * POST /v1/snippets/:id/share
   * Share snippet.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  async shareSnippet(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.postsService.sharePost(id);
  }

  /**
   * PATCH /v1/snippets/:id/toggle-comments
   * Disable / Enable comments on snippet.
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
   * POST /v1/snippets/:id/report
   * Report snippet.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportSnippet(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportPostDto,
  ) {
    return this.postsService.reportPost(id, req.user!.userId, dto);
  }

  /**
   * DELETE /v1/snippets/:id
   * Delete published snippet (owner or admin only).
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteSnippet(
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

