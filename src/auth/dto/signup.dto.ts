import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsValidPhoneForCountry } from '../phone-validation.util';

export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @Matches(/^[\p{L}\p{M}\s]+$/u, {
    message: 'Name must contain letters only (no numbers or symbols)',
  })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MinLength(6, { message: 'Email must be at least 6 characters long' })
  @MaxLength(254, { message: 'Email cannot exceed 254 characters' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^\d+$/, { message: 'Phone must contain digits only (without country code)' })
  @IsValidPhoneForCountry()
  phone: string;

  @ValidateIf((o) => !o.country_code)
  @IsNotEmpty({ message: 'Country code is required' })
  @IsString({ message: 'Country code must be a string' })
  @Matches(/^\+[1-9]\d{0,2}$/, {
    message: 'Country code must start with + followed by 1 to 3 digits (e.g. +1, +20, +966, +971)',
  })
  countryCode?: string;

  @ValidateIf((o) => o.country_code !== undefined)
  @IsNotEmpty({ message: 'Country code is required' })
  @IsString({ message: 'Country code must be a string' })
  @Matches(/^\+[1-9]\d{0,2}$/, {
    message: 'Country code must start with + followed by 1 to 3 digits (e.g. +1, +20, +966, +971)',
  })
  country_code?: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(74, { message: 'Password cannot exceed 74 characters' })
  @Matches(/(?=.*[A-Z])/, {
    message: 'Password must contain at least one capital letter',
  })
  @Matches(/(?=.*\d)/, {
    message: 'Password must contain at least one number',
  })
  password: string;

  @ValidateIf(
    (o) =>
      o.agreeToTerms === undefined &&
      o.agree_to_terms === undefined &&
      o.accept_terms === undefined,
  )
  @Equals(true, { message: 'You must accept the terms of use and privacy policy' })
  acceptTerms?: boolean;

  @ValidateIf((o) => o.agreeToTerms !== undefined)
  @Equals(true, { message: 'You must accept the terms of use and privacy policy' })
  agreeToTerms?: boolean;

  @ValidateIf((o) => o.accept_terms !== undefined)
  @Equals(true, { message: 'You must accept the terms of use and privacy policy' })
  accept_terms?: boolean;

  @ValidateIf((o) => o.agree_to_terms !== undefined)
  @Equals(true, { message: 'You must accept the terms of use and privacy policy' })
  agree_to_terms?: boolean;

  @IsOptional()
  @IsString()
  code?: string;
}
