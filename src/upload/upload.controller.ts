import {
  Controller,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';
import { I18nService } from '../i18n/i18n.service';
import { UploadFile } from './upload-file.interface';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * POST /v1/upload/avatar
   * Upload user profile avatar (Max 10MB, JPG/PNG/WEBP/HEIC/HEIF)
   */
  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files?: UploadFile[],
  ) {
    const file = files && files.length > 0 ? files[0] : undefined;
    if (!file) {
      throw new BadRequestException(this.i18n.t('upload.file_required'));
    }
    return this.uploadService.uploadAvatar(req.user.userId, file);
  }
}
