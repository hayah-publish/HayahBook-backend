
import {
  IsIn,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  author?: string;

  @IsOptional()
@IsString()
@MaxLength(100)
category?: string;

  @IsOptional()
  @IsIn(['ebook', 'audiobook'])
  contentType?: 'ebook' | 'audiobook';

@IsOptional()
@IsString()
@IsUrl({ require_protocol: true })
coverUrl?: string;

@IsOptional()
@IsString()
@IsUrl({ require_protocol: true })
contentUrl?: string;
}
