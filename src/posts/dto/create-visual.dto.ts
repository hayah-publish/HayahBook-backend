import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { MaxWords } from '../validators/word-count.validator';
import { PostLinkDto } from './create-post.dto';

export class CreateVisualDto {
  @IsOptional()
  @IsIn(['visual'] as const)
  type?: 'visual' = 'visual' as const;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  subcategory?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxWords(500, { message: 'posts.max_words_exceeded' })
  content?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  aspectRatio?: string = '9:16';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  bookId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  audiobookId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  bookIds?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentions?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        return plainToInstance(PostLinkDto, JSON.parse(value));
      } catch {
        return plainToInstance(PostLinkDto, { url: value });
      }
    }
    return plainToInstance(PostLinkDto, value);
  })
  @ValidateNested()
  @Type(() => PostLinkDto)
  link?: PostLinkDto;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value || value === '') return undefined;
    let list = value;
    if (typeof value === 'string') {
      try {
        list = JSON.parse(value);
      } catch {
        list = [{ url: value }];
      }
    }
    if (!Array.isArray(list)) {
      list = [list];
    }
    return list.map((item: any) =>
      typeof item === 'string'
        ? plainToInstance(PostLinkDto, { url: item })
        : plainToInstance(PostLinkDto, item),
    );
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostLinkDto)
  links?: PostLinkDto[];

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUrl({ require_protocol: true })
  linkUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @MaxLength(255)
  linkTitle?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  commentsDisabled?: boolean;

  @IsOptional()
  images?: any;

  @IsOptional()
  image?: any;
}
