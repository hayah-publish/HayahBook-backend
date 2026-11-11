import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { MaxWords, MinWords } from '../validators/word-count.validator';

export class PostLinkDto {
  @IsUrl({ require_protocol: true })
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}

export class CreatePostDto {
  @IsOptional()
  @IsIn(['post'] as const)
  type?: 'post' = 'post' as const;

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
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  cover?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  agreeToTerms?: any;

  @IsOptional()
  @IsString()
  @MinWords(1, { message: 'posts.min_words_required' })
  @MaxWords(500, { message: 'posts.max_words_exceeded' })
  content?: string;

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
  @IsString({ each: true })
  images?: string[];

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  containVideo?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  image?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  video?: any;

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
        return [value];
      }
    }
    return value;
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  mentions?: string[];
}
