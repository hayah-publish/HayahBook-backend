import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class RequestChangeEmailOtpDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'New email is required' })
  @MinLength(6, { message: 'Email must be at least 6 characters long' })
  @MaxLength(254, { message: 'Email cannot exceed 254 characters' })
  newEmail: string;
}

