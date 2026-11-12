import { PayloadTooLargeException } from '@nestjs/common';
import type { Request } from 'express';
import type { StorageEngine } from 'multer';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
]);

/**
 * Keep the existing in-memory video behavior, but stop oversized image parts
 * while Multer is streaming them instead of after they have filled a buffer.
 */
export class MimeLimitedMemoryStorage implements StorageEngine {
  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const isVideo = ALLOWED_VIDEO_TYPES.has(file.mimetype);
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    const errorKey = isVideo
      ? 'upload.video_size_exceeded'
      : 'upload.image_size_exceeded';
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    file.stream.on('data', (chunk: Buffer | string) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) {
        settled = true;
        chunks.length = 0;
        callback(new PayloadTooLargeException(errorKey));
        file.stream.resume();
        return;
      }
      chunks.push(buffer);
    });

    file.stream.once('error', (error: Error) => {
      if (settled) return;
      settled = true;
      callback(error);
    });

    file.stream.once('end', () => {
      if (settled) return;
      settled = true;
      callback(null, { buffer: Buffer.concat(chunks, size), size });
    });
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    (file as unknown as { buffer?: Buffer }).buffer = undefined;
    callback(null);
  }
}

export const mimeLimitedMemoryStorage = new MimeLimitedMemoryStorage();
