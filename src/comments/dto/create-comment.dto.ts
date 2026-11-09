import { IsNotEmpty, IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommentDto {
  @IsOptional()
  @IsUUID('4')
  postId?: string;

  @IsNotEmpty({ message: 'comments.content_required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
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
}
