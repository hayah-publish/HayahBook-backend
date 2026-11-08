import { IsNotEmpty, IsString } from 'class-validator';

export class ReactPostDto {
  @IsNotEmpty({ message: 'reactions.invalid_type' })
  @IsString()
  reaction: string;
}

