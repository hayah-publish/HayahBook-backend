import { IsEmail, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class RequestSignupOtpDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MinLength(6, { message: 'Email must be at least 6 characters long' })
  @MaxLength(254, { message: 'Email cannot exceed 254 characters' })
  email: string;
}

