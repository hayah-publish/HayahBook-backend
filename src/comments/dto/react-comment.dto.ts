import { IsNotEmpty, IsString } from 'class-validator';

export class ReactCommentDto {
  @IsNotEmpty({ message: 'reactions.invalid_type' })
  @IsString()
  reaction: string;
}
