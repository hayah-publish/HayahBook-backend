import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateExcerptDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'content must be a string' })
  @IsNotEmpty({ message: 'content cannot be empty' })
  content?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'note must be a string' })
  @MaxLength(2000, { message: 'note cannot exceed 2000 characters' })
  note?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'chapter must be a string' })
  @MaxLength(150, { message: 'chapter cannot exceed 150 characters' })
  chapter?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null && value !== '' ? Number(value) : undefined))
  @IsInt({ message: 'pageNumber must be an integer' })
  @Min(1, { message: 'pageNumber must be at least 1' })
  pageNumber?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'color must be a string' })
  @MaxLength(30, { message: 'color cannot exceed 30 characters' })
  color?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'cfiRange must be a string' })
  @MaxLength(255, { message: 'cfiRange cannot exceed 255 characters' })
  cfiRange?: string;
}
