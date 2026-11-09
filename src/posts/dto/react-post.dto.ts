import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ReactPostDto {
  @IsNotEmpty({ message: 'reactions.invalid_type' })
  @IsString()
  reaction: string;

  @IsOptional()
  @IsUUID('4')
  id?: string;

  @IsOptional()
  @IsUUID('4')
  postId?: string;

  @IsOptional()
  @IsUUID('4')
  targetId?: string;
}

