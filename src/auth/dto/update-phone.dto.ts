import { IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { IsValidPhoneForCountry } from '../phone-validation.util';

export class UpdatePhoneDto {
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
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^\d+$/, { message: 'Phone must contain digits only' })
  @IsValidPhoneForCountry()
  phone: string;

  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits' })
  code: string;
}

