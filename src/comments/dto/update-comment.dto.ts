import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCommentDto {
  @IsNotEmpty({ message: 'comments.content_required' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;
}

