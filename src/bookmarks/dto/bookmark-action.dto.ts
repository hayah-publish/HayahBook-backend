import { IsNotEmpty, IsUUID } from 'class-validator';

export class BookmarkActionDto {
  @IsNotEmpty()
  @IsUUID()
  postId: string;
}
