import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code: string;
}
