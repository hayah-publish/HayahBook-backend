import { IsOptional, IsString, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export type CommentSortType = 'most_interactive' | 'newest' | 'oldest';

export class CommentsQueryDto {
  @IsOptional()
  @IsUUID('4')
  contentId?: string;

  @IsOptional()
  @IsUUID('4')
  postId?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

