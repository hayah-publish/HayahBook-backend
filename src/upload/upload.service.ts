import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomBytes } from 'crypto';
import { User } from '../users/user.entity';
import { Author } from '../authors/author.entity';
import { Creator } from '../creators/creator.entity';
import { I18nService } from '../i18n/i18n.service';
import { UploadFile } from './upload-file.interface';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'image/heic',
  'image/heif',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function hasSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' &&
      /^(heic|heix|hevc|hevx|mif1|msf1|heif)$/.test(buffer.toString('ascii', 8, 12));
  }
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' &&
      (mimeType === 'video/mp4'
        ? buffer.toString('ascii', 8, 12) !== 'qt  '
        : buffer.toString('ascii', 8, 12) === 'qt  ');
  }
  if (mimeType === 'video/webm' || mimeType === 'video/x-matroska') {
    return buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return false;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
    @InjectRepository(Creator)
    private readonly creatorsRepository: Repository<Creator>,
    private readonly i18n: I18nService,
  ) {
    const accountId = process.env.R2_ACCOUNT_ID || '';
    const endpoint =
      process.env.R2_S3_ENDPOINT ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.bucketName = process.env.R2_BUCKET_NAME || 'hayahbook-uploads';
    this.publicUrl = (process.env.R2_PUBLIC_URL || 'https://cdn.hayahbook.com').replace(/\/$/, '');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Upload raw buffer to Cloudflare R2
   */
  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    const cleanKey = key.replace(/^\/+/, '');
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    return `${this.publicUrl}/${cleanKey}`;
  }

  /**
   * Delete an object from Cloudflare R2
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const cleanKey = key.replace(/^\/+/, '');
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
      });
      await this.s3Client.send(command);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to delete file from R2 (${key}): ${message}`);
    }
  }

  /**
   * Delete an object from Cloudflare R2 given its public URL
   */
  async deleteFileByUrl(url?: string | null): Promise<void> {
    const key = this.extractKeyFromUrl(url);
    if (key) {
      await this.deleteFile(key);
    }
  }

  /**
   * Extract R2 key from a full public URL if it points to our domain
   */
  private extractKeyFromUrl(url?: string | null): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const publicBase = new URL(this.publicUrl);
      if (parsed.origin !== publicBase.origin) return null;

      const basePath = publicBase.pathname.replace(/\/+$/, '');
      const objectPath = basePath
        ? parsed.pathname.startsWith(`${basePath}/`)
          ? parsed.pathname.slice(basePath.length + 1)
          : null
        : parsed.pathname.replace(/^\/+/, '');
      if (!objectPath) return null;
      const key = decodeURIComponent(objectPath);
      if (!/^(avatars|posts\/images|posts\/videos|articles\/covers)\//.test(key) ||
          key.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')) {
        return null;
      }
      return key;
    } catch {
      // not a valid URL, ignore
    }
    return null;
  }

  /**
   * Upload user profile avatar to Cloudflare R2 and update users table
   */
  async uploadAvatar(
    userId: string,
    file?: UploadFile,
  ): Promise<{ profileUrl: string; message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException(this.i18n.t('upload.file_required'));
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
    }
    if (!hasSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(this.i18n.t('upload.file_too_large'));
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    // Determine extension
    let ext = 'jpg';
    if (file.mimetype === 'image/png') ext = 'png';
    else if (file.mimetype === 'image/webp') ext = 'webp';
    else if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') ext = 'heic';

    // Key format: avatars/{userId}_{timestamp}_{randomHex}.{ext}
    const randomHex = randomBytes(4).toString('hex');
    const newKey = `avatars/${userId}_${Date.now()}_${randomHex}.${ext}`;

    const previousKey = this.extractKeyFromUrl(user.profileUrl);
    const uploadedUrl = await this.uploadFile(file.buffer, newKey, file.mimetype);

    try {
      user.profileUrl = uploadedUrl;
      await this.usersRepository.save(user);

      // Keep authors and creators tables synchronized if user is an author or creator
      await this.authorsRepository.update({ id: userId }, { profileUrl: uploadedUrl });
      await this.creatorsRepository.update({ id: userId }, { profileUrl: uploadedUrl });
    } catch (error) {
      await this.deleteFile(newKey);
      throw error;
    }

    if (previousKey && previousKey !== newKey) {
      await this.deleteFile(previousKey);
    }

    return {
      message: this.i18n.t('upload.avatar_success'),
      profileUrl: uploadedUrl,
    };
  }

  /**
   * Upload single article cover image to Cloudflare R2 (Max 20MB)
   */
  async uploadArticleCover(
    userId: string,
    file?: UploadFile,
  ): Promise<{ url: string; message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException(this.i18n.t('articles.cover_required'));
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !hasSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
    }

    const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(this.i18n.t('upload.image_size_exceeded'));
    }

    let ext = 'jpg';
    if (file.mimetype === 'image/png') ext = 'png';
    else if (file.mimetype === 'image/webp') ext = 'webp';
    else if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') ext = 'heic';

    const randomHex = randomBytes(4).toString('hex');
    const newKey = `articles/covers/${userId}_${Date.now()}_${randomHex}.${ext}`;

    const url = await this.uploadFile(file.buffer, newKey, file.mimetype);
    return {
      url,
      message: this.i18n.t('common.success'),
    };
  }

  /**
   * Upload multiple post images to Cloudflare R2 (Max 10 images, max 20MB per image)
   */
  async uploadPostImages(
    userId: string,
    files?: UploadFile[],
  ): Promise<{ urls: string[]; message: string }> {
    if (!files || files.length === 0) {
      throw new BadRequestException(this.i18n.t('upload.file_required'));
    }

    if (files.length > 10) {
      throw new BadRequestException(this.i18n.t('upload.images_limit_exceeded'));
    }

    const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
    const urls: string[] = [];

    try {
      for (const file of files) {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
        }
        if (!hasSignature(file.buffer, file.mimetype)) {
          throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
        }

        if (file.size > MAX_IMAGE_SIZE) {
          throw new BadRequestException(this.i18n.t('upload.image_size_exceeded'));
        }

        let ext = 'jpg';
        if (file.mimetype === 'image/png') ext = 'png';
        else if (file.mimetype === 'image/webp') ext = 'webp';
        else if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') ext = 'heic';

        const randomHex = randomBytes(4).toString('hex');
        const newKey = `posts/images/${userId}_${Date.now()}_${randomHex}.${ext}`;

        const uploadedUrl = await this.uploadFile(file.buffer, newKey, file.mimetype);
        urls.push(uploadedUrl);
      }
    } catch (error) {
      await Promise.all(urls.map((url) => this.deleteFileByUrl(url)));
      throw error;
    }

    return {
      message: this.i18n.t('upload.post_images_success'),
      urls,
    };
  }

  /**
   * Upload post video to Cloudflare R2 (Max 1 video, max 500MB)
   */
  async uploadPostVideo(
    userId: string,
    file?: UploadFile,
  ): Promise<{ videoUrl: string; message: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException(this.i18n.t('upload.file_required'));
    }

    const ALLOWED_VIDEO_TYPES = [
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-matroska',
    ];

    if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(this.i18n.t('upload.invalid_video_type'));
    }
    if (!hasSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException(this.i18n.t('upload.invalid_video_type'));
    }

    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
    if (file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestException(this.i18n.t('upload.video_size_exceeded'));
    }

    let ext = 'mp4';
    if (file.mimetype === 'video/quicktime') ext = 'mov';
    else if (file.mimetype === 'video/webm') ext = 'webm';
    else if (file.mimetype === 'video/x-matroska') ext = 'mkv';

    const randomHex = randomBytes(4).toString('hex');
    const newKey = `posts/videos/${userId}_${Date.now()}_${randomHex}.${ext}`;

    const uploadedUrl = await this.uploadFile(file.buffer, newKey, file.mimetype);

    return {
      message: this.i18n.t('upload.post_video_success'),
      videoUrl: uploadedUrl,
    };
  }
}
