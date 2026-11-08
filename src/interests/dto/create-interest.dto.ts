import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateInterestDto {
  @IsString()
  @IsNotEmpty({ message: 'Interest name is required' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
