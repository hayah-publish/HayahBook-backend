import { IsNotEmpty, IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReplyDto {
  @IsOptional()
  @IsUUID('4')
  commentId?: string;

  @IsNotEmpty({ message: 'comments.content_required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @IsOptional()
  @IsUUID('4')
  replyToUserId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  image?: any;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  })
  mentions?: string[];
}

