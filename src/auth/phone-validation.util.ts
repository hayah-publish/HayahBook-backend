import {
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from 'libphonenumber-js';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface CountryPhoneInfo {
  nameAr: string;
  nameEn: string;
  digitsAr: string;
  digitsEn: string;
  example: string;
}

export const COUNTRY_PHONE_INFO: Record<string, CountryPhoneInfo> = {
  '+20': {
    nameAr: 'مصر',
    nameEn: 'Egypt',
    digitsAr: '10 أو 11 رقماً',
    digitsEn: '10 or 11 digits',
    example: '10XXXXXXXX أو 010XXXXXXXX',
  },
  '+966': {
    nameAr: 'السعودية',
    nameEn: 'Saudi Arabia',
    digitsAr: '9 أو 10 أرقام',
    digitsEn: '9 or 10 digits',
    example: '5XXXXXXXX أو 05XXXXXXXX',
  },
  '+971': {
    nameAr: 'الإمارات',
    nameEn: 'UAE',
    digitsAr: '9 أو 10 أرقام',
    digitsEn: '9 or 10 digits',
    example: '5XXXXXXXX أو 05XXXXXXXX',
  },
  '+965': {
    nameAr: 'الكويت',
    nameEn: 'Kuwait',
    digitsAr: '8 أرقام',
    digitsEn: '8 digits',
    example: '5XXXXXXX أو 6XXXXXXX أو 9XXXXXXX',
  },
  '+974': {
    nameAr: 'قطر',
    nameEn: 'Qatar',
    digitsAr: '8 أرقام',
    digitsEn: '8 digits',
    example: '3XXXXXXX أو 5XXXXXXX أو 6XXXXXXX',
  },
  '+973': {
    nameAr: 'البحرين',
    nameEn: 'Bahrain',
    digitsAr: '8 أرقام',
    digitsEn: '8 digits',
    example: '3XXXXXXX أو 6XXXXXXX',
  },
  '+968': {
    nameAr: 'عُمان',
    nameEn: 'Oman',
    digitsAr: '8 أرقام',
    digitsEn: '8 digits',
    example: '7XXXXXXX أو 9XXXXXXX',
  },
  '+962': {
    nameAr: 'الأردن',
    nameEn: 'Jordan',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '7XXXXXXXX',
  },
  '+964': {
    nameAr: 'العراق',
    nameEn: 'Iraq',
    digitsAr: '10 أو 11 رقماً',
    digitsEn: '10 or 11 digits',
    example: '7XXXXXXXXX',
  },
  '+961': {
    nameAr: 'لبنان',
    nameEn: 'Lebanon',
    digitsAr: '7 أو 8 أرقام',
    digitsEn: '7 or 8 digits',
    example: '3XXXXXX أو 7XXXXXXX',
  },
  '+212': {
    nameAr: 'المغرب',
    nameEn: 'Morocco',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '6XXXXXXXX أو 7XXXXXXXX',
  },
  '+213': {
    nameAr: 'الجزائر',
    nameEn: 'Algeria',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '5XXXXXXXX أو 6XXXXXXXX',
  },
  '+216': {
    nameAr: 'تونس',
    nameEn: 'Tunisia',
    digitsAr: '8 أرقام',
    digitsEn: '8 digits',
    example: '2XXXXXXX أو 9XXXXXXX',
  },
  '+218': {
    nameAr: 'ليبيا',
    nameEn: 'Libya',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '9XXXXXXXX',
  },
  '+249': {
    nameAr: 'السودان',
    nameEn: 'Sudan',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '9XXXXXXXX أو 1XXXXXXXX',
  },
  '+967': {
    nameAr: 'اليمن',
    nameEn: 'Yemen',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '7XXXXXXXX',
  },
  '+970': {
    nameAr: 'فلسطين',
    nameEn: 'Palestine',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '5XXXXXXXX',
  },
  '+963': {
    nameAr: 'سوريا',
    nameEn: 'Syria',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '9XXXXXXXX',
  },
  '+1': {
    nameAr: 'أمريكا / كندا',
    nameEn: 'USA / Canada',
    digitsAr: '10 أرقام',
    digitsEn: '10 digits',
    example: '2025550123',
  },
  '+44': {
    nameAr: 'المملكة المتحدة',
    nameEn: 'UK',
    digitsAr: '10 أرقام',
    digitsEn: '10 digits',
    example: '7XXXXXXXXX',
  },
  '+49': {
    nameAr: 'ألمانيا',
    nameEn: 'Germany',
    digitsAr: '10 أو 11 رقماً',
    digitsEn: '10 or 11 digits',
    example: '15XXXXXXXXX',
  },
  '+33': {
    nameAr: 'فرنسا',
    nameEn: 'France',
    digitsAr: '9 أرقام',
    digitsEn: '9 digits',
    example: '6XXXXXXXX',
  },
  '+90': {
    nameAr: 'تركيا',
    nameEn: 'Turkey',
    digitsAr: '10 أرقام',
    digitsEn: '10 digits',
    example: '5XXXXXXXXX',
  },
};

export interface PhoneValidationResult {
  isValid: boolean;
  messageEn?: string;
  messageAr?: string;
  country?: string;
}

export function validatePhoneForCountry(
  countryCode?: string | null,
  phone?: string | null,
): PhoneValidationResult {
  if (!phone) return { isValid: true };

  const cleanPhone = String(phone).trim();
  if (!cleanPhone) return { isValid: true };

  const cleanCode = countryCode
    ? countryCode.trim().startsWith('+')
      ? countryCode.trim()
      : `+${countryCode.trim()}`
    : '+20';

  const fullNumber = `${cleanCode}${cleanPhone}`;
  const parsed = parsePhoneNumberFromString(fullNumber);
  const lengthStatus = validatePhoneNumberLength(fullNumber);
  const isValid = parsed ? parsed.isValid() : false;

  const info = COUNTRY_PHONE_INFO[cleanCode];

  if (!isValid) {
    if (info) {
      return {
        isValid: false,
        messageEn: `Phone number must be ${info.digitsEn} for country code ${cleanCode} (e.g. ${info.example})`,
        messageAr: `رقم الهاتف يجب أن يتكون من ${info.digitsAr} لكود الدولة ${cleanCode} (مثال: ${info.example})`,
        country: parsed?.country,
      };
    }

    if (lengthStatus === 'TOO_SHORT') {
      return {
        isValid: false,
        messageEn: `Phone number is too short for country code ${cleanCode}`,
        messageAr: `رقم الهاتف أقصر من اللازم لكود الدولة ${cleanCode}`,
        country: parsed?.country,
      };
    }

    if (lengthStatus === 'TOO_LONG') {
      return {
        isValid: false,
        messageEn: `Phone number is too long for country code ${cleanCode}`,
        messageAr: `رقم الهاتف أطول من اللازم لكود الدولة ${cleanCode}`,
        country: parsed?.country,
      };
    }

    return {
      isValid: false,
      messageEn: `Phone number is invalid for country code ${cleanCode}`,
      messageAr: `رقم الهاتف غير صالح لكود الدولة ${cleanCode}`,
      country: parsed?.country,
    };
  }

  return {
    isValid: true,
    country: parsed?.country,
  };
}

@ValidatorConstraint({ name: 'isValidPhoneForCountry', async: false })
export class IsValidPhoneForCountryConstraint implements ValidatorConstraintInterface {
  validate(phone: unknown, args: ValidationArguments): boolean {
    if (typeof phone !== 'string' || !phone.trim()) return true;
    const obj = args.object as Record<string, unknown>;
    const countryCode = (obj.countryCode ?? obj.country_code) as string | undefined;
    const result = validatePhoneForCountry(countryCode, phone);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as Record<string, unknown>;
    const countryCode = (obj.countryCode ?? obj.country_code) as string | undefined;
    const phone = args.value as string | undefined;
    const result = validatePhoneForCountry(countryCode, phone);
    return result.messageEn || 'Phone number is invalid for the selected country code';
  }
}

export function IsValidPhoneForCountry(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneForCountryConstraint,
    });
  };
}

