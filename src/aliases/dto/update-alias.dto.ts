import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateAliasDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nickname must be a string' })
  @MaxLength(50, { message: 'Nickname cannot exceed 50 characters' })
  nickname?: string;

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
