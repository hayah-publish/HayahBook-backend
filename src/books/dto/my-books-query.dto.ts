import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MyBooksQueryDto {
  @IsOptional()
  @IsIn(['finished', 'reading', 'want_to_read', 'all'])
  status?: 'finished' | 'reading' | 'want_to_read' | 'all';

  @IsOptional()
  @IsIn(['ebook', 'audiobook', 'both', 'all'])
  type?: 'ebook' | 'audiobook' | 'both' | 'all';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

