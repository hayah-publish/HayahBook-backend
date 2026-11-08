import { IsIn, IsOptional, IsString } from 'class-validator';

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
  page?: number;

  @IsOptional()
  limit?: number;
}

