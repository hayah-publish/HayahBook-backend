import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateSnippetDto {
  @IsOptional()
  @IsUUID('4', { message: 'excerptId must be a valid UUID' })
  excerptId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'bookId must be a valid UUID' })
  bookId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'content must be a string' })
  @MaxLength(2000, { message: 'content cannot exceed 2000 characters' })
  content?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'quote must be a string' })
  @MaxLength(5000, { message: 'quote cannot exceed 5000 characters' })
  quote?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1) return true;
    if (value === 'false' || value === false || value === '0' || value === 0) return false;
    return undefined;
  })
  @IsBoolean()
  showBookDetails?: boolean = true;
}
