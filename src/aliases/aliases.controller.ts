import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AliasesService } from './aliases.service';
import { CreateAliasDto } from './dto/create-alias.dto';
import { UpdateAliasDto } from './dto/update-alias.dto';
import type { UploadFile } from '../upload/upload-file.interface';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}
@Controller('aliases')
export class AliasesController {
  constructor(private readonly aliasesService: AliasesService) {}

  /**
   * GET /v1/aliases/presets (or /v1/aliases/avatars)
   * Predefined avatars (pictures only) for alias creation
   */
  @Get(['presets', 'avatars'])
  getPresets() {
    const presets = this.aliasesService.getPresets();
    return { data: presets };
  }

  /**
   * GET /v1/aliases/check-nickname?nickname=...
   * Check if a nickname is unique and available
   */
  @Get(['check-nickname', 'check'])
  async checkNickname(
    @Query('nickname') nickname: string,
    @Query('excludeAliasId') excludeAliasId?: string,
  ) {
    return this.aliasesService.checkNicknameAvailability(
      nickname,
      excludeAliasId,
    );
  }

  /**
   * GET /v1/aliases/identity-options
   * Returns identity options for Bottom Sheet modal (Image 1)
   */
  @UseGuards(JwtAuthGuard)
  @Get(['identity-options', 'options'])
  async getIdentityOptions(
    @Req() req: AuthenticatedRequest,
    @Query('lang') lang?: string,
  ) {
    const options = await this.aliasesService.getIdentityOptions(
      req.user!.userId,
      lang,
    );
    return { data: options };
  }

  /**
   * GET /v1/aliases/my (or /v1/me/aliases)
   * Get all aliases owned by caller
   */
  @UseGuards(JwtAuthGuard)
  @Get(['my', 'me'])
  async getMyAliases(@Req() req: AuthenticatedRequest) {
    const aliases = await this.aliasesService.getMyAliases(req.user!.userId);
    return { data: aliases };
  }

  /**
   * POST /v1/aliases
   * Create an alias with custom nickname and optional avatar upload/url (Image 2)
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async createAlias(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAliasDto,
    @UploadedFile() file?: UploadFile,
  ) {
    const alias = await this.aliasesService.createAlias(
      req.user!.userId,
      dto,
      file,
    );
    return {
      message: 'Alias created successfully',
      data: alias,
    };
  }

  /**
   * GET /v1/aliases/:id
   * Public profile of an alias with statistics (Image 3)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async getAliasProfile(@Param('id', new ParseUUIDPipe()) id: string) {
    const profile = await this.aliasesService.getAliasProfile(id);
    return { data: profile };
  }

  /**
   * GET /v1/aliases/:id/comments
   * Comments written by this alias (Image 3 Tab 1 "Comments")
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/comments')
  async getAliasComments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.aliasesService.getAliasComments(
      id,
      Number(page) || 1,
      Number(limit) || 20,
    );
    return result;
  }

  /**
   * GET /v1/aliases/:id/books/reviews
   * Book reviews written by this alias (Image 3 Tab 2 "Books" -> "Reviews")
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get([':id/books/reviews', ':id/reviews'])
  async getAliasBookReviews(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.aliasesService.getAliasBookReviews(
      id,
      Number(page) || 1,
      Number(limit) || 20,
    );
    return result;
  }

  /**
   * GET /v1/aliases/:id/books/ratings
   * Book ratings given by this alias (Image 3 Tab 2 "Books" -> "Ratings")
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get([':id/books/ratings', ':id/ratings'])
  async getAliasBookRatings(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.aliasesService.getAliasBookRatings(
      id,
      Number(page) || 1,
      Number(limit) || 20,
    );
    return result;
  }

  /**
   * PATCH /v1/aliases/:id
   * Update alias details or avatar
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateAlias(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAliasDto,
    @UploadedFile() file?: UploadFile,
  ) {
    const alias = await this.aliasesService.updateAlias(
      req.user!.userId,
      id,
      dto,
      file,
    );
    return {
      message: 'Alias updated successfully',
      data: alias,
    };
  }

  /**
   * DELETE /v1/aliases/:id
   * Delete an alias
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAlias(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const result = await this.aliasesService.deleteAlias(req.user!.userId, id);
    return {
      message: result.message,
      data: { id, deleted: true },
    };
  }
}
