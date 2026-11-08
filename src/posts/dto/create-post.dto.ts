import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

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
  @IsIn(['post', 'article'])
  type?: 'post' | 'article' = 'post';

  @IsNotEmpty()
  @IsString()
  content: string;

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
