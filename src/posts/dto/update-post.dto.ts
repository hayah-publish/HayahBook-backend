import {
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MaxWords } from '../validators/word-count.validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxWords(5000, { message: 'posts.max_words_exceeded' })
  content?: string;

  @IsOptional()
  @IsUUID('4')
  bookId?: string | null;

  @IsOptional()
  @IsUUID('4')
  audiobookId?: string | null;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  videoUrl?: string | null;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  linkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkTitle?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [value];
      }
    }
    return value;
  })
  @IsArray()
  @IsUUID('4', { each: true })
  mentions?: string[] | string;

  @IsOptional()
  keepImages?: string[] | string;
}
