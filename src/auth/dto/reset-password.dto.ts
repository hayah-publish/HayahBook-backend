import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MinLength(6, { message: 'Email must be at least 6 characters long' })
  @MaxLength(254, { message: 'Email cannot exceed 254 characters' })
  email: string;

  @IsOptional()
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code?: string;

  @IsOptional()
  @IsString({ message: 'Reset token must be a string' })
  resetToken?: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @MaxLength(74, { message: 'New password cannot exceed 74 characters' })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one capital letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  newPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirm password is required' })
  confirmPassword: string;
}

