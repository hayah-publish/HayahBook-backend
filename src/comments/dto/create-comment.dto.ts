import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsIn,
  IsBoolean,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommentDto {
  @IsOptional()
  @IsUUID('4')
  postId?: string;

  @IsOptional()
  @IsUUID('4')
  contentId?: string;

  @IsNotEmpty({ message: 'comments.content_required' })
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  image?: any;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
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

  @IsOptional()
  @IsIn(['primary', 'alias', 'anonymous'], { message: 'Invalid identityType' })
  identityType?: 'primary' | 'alias' | 'anonymous';

  @IsOptional()
  @IsUUID('4', { message: 'aliasId must be a valid UUID' })
  aliasId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(
    ({ value }) =>
      value === true || value === 'true' || value === 1 || value === '1',
  )
  isAnonymous?: boolean;
}
