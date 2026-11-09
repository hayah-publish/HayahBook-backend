import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentsQueryDto } from './dto/comments-query.dto';
import { ReactCommentDto } from './dto/react-comment.dto';
import { ReportCommentDto } from './dto/report-comment.dto';
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

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * 1. Create a root comment
   * POST /v1/comments
   * Supports multipart/form-data with file 'image' or application/json with 'imageUrl'
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async createComment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCommentDto,
    @UploadedFile() image?: UploadFile,
  ) {
    return this.commentsService.createComment(
      req.user!.userId,
      dto,
      dto.postId,
      image,
    );
  }

  /**
   * 2. Create a reply to an existing comment
   * POST /v1/comments/:id/reply
   * Supports multipart/form-data with file 'image' or application/json with 'imageUrl'
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/reply')
  @UseInterceptors(FileInterceptor('image'))
  async createReply(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateReplyDto,
    @UploadedFile() image?: UploadFile,
  ) {
    return this.commentsService.createReply(
      req.user!.userId,
      id,
      dto,
      image,
    );
  }

  /**
   * 3. Get root comments for a post/article/visual/snippet
   * GET /v1/comments?postId=...&sort=most_interactive&page=1&limit=20
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getComments(
    @Query() query: CommentsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    const postId = query.postId;
    if (!postId) {
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };
    }
    return this.commentsService.getPostComments(postId, query, req?.user?.userId);
  }

  /**
   * 4. Get replies for a specific comment
   * GET /v1/comments/:id/replies?page=1&limit=10
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/replies')
  async getCommentReplies(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: CommentsQueryDto,
    @Req() req?: AuthenticatedRequest,
  ) {
    return this.commentsService.getCommentReplies(id, query, req?.user?.userId);
  }

  /**
   * 5. React to comment (agree, love, applaud, insightful, disagree)
   * POST /v1/comments/:id/react
   * Toggle ON/OFF or Switch Reaction
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/react')
  async reactToComment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReactCommentDto,
  ) {
    return this.commentsService.reactToComment(
      req.user!.userId,
      id,
      dto.reaction,
    );
  }

  /**
   * 6. Remove reaction from comment
   * DELETE /v1/comments/:id/react
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/react')
  @HttpCode(HttpStatus.OK)
  async removeCommentReaction(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.commentsService.removeCommentReaction(req.user!.userId, id);
  }

  /**
   * 7. Pin / Unpin comment
   * PATCH /v1/comments/:id/pin
   * Post Owner or Admin only
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/pin')
  async togglePin(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const isAdmin = req.user?.role === 'admin';
    return this.commentsService.togglePinComment(req.user!.userId, id, isAdmin);
  }

  /**
   * 8. Hide / Unhide comment
   * PATCH /v1/comments/:id/hide
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/hide')
  async toggleHide(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const isAdmin = req.user?.role === 'admin';
    return this.commentsService.toggleHideComment(req.user!.userId, id, isAdmin);
  }

  /**
   * 9. Mute / Unmute comment notifications
   * PATCH /v1/comments/:id/mute
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/mute')
  async toggleMute(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.commentsService.toggleMuteComment(req.user!.userId, id);
  }

  /**
   * 10. Report comment
   * POST /v1/comments/:id/report
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/report')
  async reportComment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReportCommentDto,
  ) {
    return this.commentsService.reportComment(req.user!.userId, id, dto.reason);
  }

  /**
   * 11. Edit comment
   * PATCH /v1/comments/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateComment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(
      req.user!.userId,
      id,
      dto.content,
    );
  }

  /**
   * 12. Delete comment
   * DELETE /v1/comments/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const isAdmin = req.user?.role === 'admin';
    return this.commentsService.deleteComment(req.user!.userId, id, isAdmin);
  }
}
