import { IsEmail, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'New email is required' })
  @MinLength(6, { message: 'Email must be at least 6 characters long' })
  @MaxLength(254, { message: 'Email cannot exceed 254 characters' })
  newEmail: string;

  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code: string;
}

