import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsQueryDto } from './dto/comments-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { UploadFile } from '../upload/upload-file.interface';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller(['content', 'posts', 'articles'])
export class ContentCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * GET /v1/content/:id/comments
   * (also supports /v1/posts/:id/comments and /v1/articles/:id/comments)
   * Universal comments feed for any content type (post, article, visual, snippet)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/comments')
  async getContentComments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CommentsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.commentsService.getPostComments(id, query, req?.user?.userId);
  }

  /**
   * POST /v1/content/:id/comments
   * (also supports /v1/posts/:id/comments and /v1/articles/:id/comments)
   * Universal endpoint to create a comment on any content type
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  @UseInterceptors(FileInterceptor('image'))
  async createContentComment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCommentDto,
    @UploadedFile() image?: UploadFile,
  ) {
    return this.commentsService.createComment(
      req.user!.userId,
      dto,
      id,
      image,
    );
  }
}

