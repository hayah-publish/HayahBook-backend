import {
  Equals,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { PostLinkDto } from './create-post.dto';
import { MaxWords, MinWords } from '../validators/word-count.validator';

export class CreateArticleDto {
  @IsNotEmpty({ message: 'articles.title_required' })
  @IsString()
  @MaxLength(255)
  title: string;

  @IsNotEmpty({ message: 'articles.content_required' })
  @IsString()
  @MinWords(500, { message: 'articles.min_words_required' })
  @MaxWords(5000, { message: 'articles.max_words_exceeded' })
  content: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  type?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  category?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID(undefined, { message: 'articles.category_invalid' })
  categoryId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  cover?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  coverImage?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  cover_image?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  mainImage?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  main_image?: any;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUrl({ require_protocol: true })
  coverImageUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUrl({ require_protocol: true })
  coverUrl?: string;

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

  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.termsAccepted;
    if (raw === 'true' || raw === true || raw === 1 || raw === '1') return true;
    return false;
  })
  @Equals(true, { message: 'articles.terms_required' })
  agreeToTerms: boolean;
}

