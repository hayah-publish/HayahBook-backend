import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsValidNickname } from '../validators/nickname.validator';

export class CreateAliasDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nickname must be a string' })
  @IsNotEmpty({ message: 'Nickname cannot be empty' })
  @MaxLength(30, { message: 'Nickname cannot exceed 30 characters' })
  @IsValidNickname()
  nickname: string;

  @IsOptional()
  @IsString({ message: 'Avatar URL must be a string' })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === true
      ? true
      : value === 'false' || value === false
        ? false
        : value,
  )
  @IsBoolean({ message: 'isDefault must be a boolean' })
  isDefault?: boolean;
}
