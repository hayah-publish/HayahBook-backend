import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ReadingStatus } from '../user-book.entity';

export class UpdateReadingStatusDto {
  @IsIn(['finished', 'reading', 'want_to_read'], {
    message: 'Status must be one of: finished, reading, want_to_read',
  })
  status: ReadingStatus;

  @IsOptional()
  @IsInt({ message: 'Progress must be an integer between 0 and 100' })
  @Min(0, { message: 'Progress cannot be less than 0' })
  @Max(100, { message: 'Progress cannot exceed 100' })
  progress?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Rating must be a number between 1.0 and 5.0' })
  @Min(1.0, { message: 'Rating cannot be less than 1.0' })
  @Max(5.0, { message: 'Rating cannot exceed 5.0' })
  rating?: number;

  @IsOptional()
  @IsString({ message: 'Notes must be a string' })
  notes?: string;
}

