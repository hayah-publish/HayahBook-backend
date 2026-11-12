import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { COUNTRY_PHONE_INFO } from '../auth/phone-validation.util';
import { ar } from './messages/ar';
import { en } from './messages/en';
import { COUNTRIES, CountryItem } from '../countries/countries.data';
import {
  DEFAULT_LANGUAGE,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from './i18n.types';

@Injectable()
export class I18nService {
  private readonly storage = new AsyncLocalStorage<SupportedLanguage>();
  private readonly messages: Record<SupportedLanguage, Record<string, string>> = {
    ar,
    en,
  };

  getSupportedLanguages(): LanguageInfo[] {
    return SUPPORTED_LANGUAGES;
  }

  getReadingLanguages(lang?: SupportedLanguage) {
    const currentLang = lang ?? this.getCurrentLanguage();
    return [
      {
        id: '01dbdd01-64f2-4744-8eb2-42af956338d3',
        displayName: currentLang === 'en' ? 'Arabic' : 'العربية',
        name_ar: 'العربية',
        name_en: 'Arabic',
      },
      {
        id: '02dbdd01-64f2-4744-8eb2-42af956338d4',
        displayName: currentLang === 'en' ? 'English' : 'الإنجليزية',
        name_ar: 'الإنجليزية',
        name_en: 'English',
      },
    ];
  }

  resolveReadingLanguage(input?: string): string {
    const ARABIC_ID = '01dbdd01-64f2-4744-8eb2-42af956338d3';
    const ENGLISH_ID = '02dbdd01-64f2-4744-8eb2-42af956338d4';
    if (!input) return 'العربية';
    const trimmed = input.trim();
    if (
      trimmed === ARABIC_ID ||
      trimmed.toLowerCase() === 'ar' ||
      trimmed.toLowerCase() === 'arabic' ||
      trimmed === 'العربية' ||
      trimmed === 'العربيه'
    ) {
      return 'العربية';
    }
    if (
      trimmed === ENGLISH_ID ||
      trimmed.toLowerCase() === 'en' ||
      trimmed.toLowerCase() === 'english' ||
      trimmed === 'الإنجليزية' ||
      trimmed === 'الانجليزية' ||
      trimmed === 'الإنجليزيه' ||
      trimmed === 'الانجليزيه'
    ) {
      return 'الإنجليزية';
    }
    return trimmed;
  }

  formatReadingLanguage(readingLanguage?: string | null, lang?: SupportedLanguage): string | null {
    if (!readingLanguage) return null;
    const currentLang = lang ?? this.getCurrentLanguage();
    const ARABIC_ID = '01dbdd01-64f2-4744-8eb2-42af956338d3';
    const ENGLISH_ID = '02dbdd01-64f2-4744-8eb2-42af956338d4';

    if (
      readingLanguage === ARABIC_ID ||
      readingLanguage === 'العربية' ||
      readingLanguage === 'العربيه' ||
      readingLanguage === 'Arabic' ||
      readingLanguage.toLowerCase() === 'ar'
    ) {
      return currentLang === 'en' ? 'Arabic' : 'العربية';
    }

    if (
      readingLanguage === ENGLISH_ID ||
      readingLanguage === 'الإنجليزية' ||
      readingLanguage === 'الانجليزية' ||
      readingLanguage === 'الإنجليزيه' ||
      readingLanguage === 'الانجليزيه' ||
      readingLanguage === 'English' ||
      readingLanguage.toLowerCase() === 'en'
    ) {
      return currentLang === 'en' ? 'English' : 'الإنجليزية';
    }

    return readingLanguage;
  }

  resolveCountry(countryInput?: string | null): CountryItem | undefined {
    if (!countryInput || !countryInput.trim()) return undefined;
    const q = countryInput.trim().toLowerCase();
    return COUNTRIES.find(
      (c) =>
        c.id.toLowerCase() === q ||
        c.name_ar.toLowerCase() === q ||
        c.name_en.toLowerCase() === q ||
        c.code.toLowerCase() === q,
    );
  }

  formatCountry(countryValue?: string | null, lang?: SupportedLanguage): string | null {
    if (!countryValue) return null;
    const currentLang = lang ?? this.getCurrentLanguage();
    const country = this.resolveCountry(countryValue);
    if (country) {
      return currentLang === 'en' ? country.name_en : country.name_ar;
    }
    return countryValue;
  }

  isSupported(lang: string): lang is SupportedLanguage {
    return lang === 'ar' || lang === 'en';
  }

  resolveLanguage(
    acceptLanguageHeader?: string,
    queryLang?: string,
    userLang?: string,
  ): SupportedLanguage {
    if (queryLang && this.isSupported(queryLang.toLowerCase())) {
      return queryLang.toLowerCase() as SupportedLanguage;
    }

    if (acceptLanguageHeader) {
      const tags = acceptLanguageHeader
        .toLowerCase()
        .split(',')
        .map((part) => part.split(';')[0].trim())
        .filter(Boolean);
      for (const tag of tags) {
        if (tag === 'ar' || tag.startsWith('ar-')) {
          return 'ar';
        }
        if (tag === 'en' || tag.startsWith('en-')) {
          return 'en';
        }
      }
    }

    if (userLang && this.isSupported(userLang.toLowerCase())) {
      return userLang.toLowerCase() as SupportedLanguage;
    }

    return DEFAULT_LANGUAGE;
  }

  runWithLanguage<T>(lang: SupportedLanguage, callback: () => T): T {
    return this.storage.run(lang, callback);
  }

  getCurrentLanguage(): SupportedLanguage {
    return this.storage.getStore() ?? DEFAULT_LANGUAGE;
  }

  t(
    key: string,
    lang?: SupportedLanguage,
    args?: Record<string, string | number>,
  ): string {
    const targetLang = lang ?? this.getCurrentLanguage();
    const dictionary = this.messages[targetLang] ?? this.messages[DEFAULT_LANGUAGE];
    let message = dictionary[key] ?? this.messages[DEFAULT_LANGUAGE][key] ?? key;

    if (args) {
      Object.entries(args).forEach(([placeholder, value]) => {
        message = message.replace(new RegExp(`{${placeholder}}`, 'g'), String(value));
      });
    }

    return message;
  }

  translateValidationMessage(message: string, lang: SupportedLanguage): string {
    const trimmed = message.trim();

    if (this.messages[lang]?.[trimmed] || this.messages[DEFAULT_LANGUAGE]?.[trimmed]) {
      return this.t(trimmed, lang);
    }

    if (lang !== 'ar') return message;

    if (VALIDATION_MESSAGES_AR[trimmed]) {
      return VALIDATION_MESSAGES_AR[trimmed];
    }

    if (/^Validation failed\s*\(uuid.*\)$/i.test(trimmed)) {
      return 'المعرّف المرسل غير صالح (يجب أن يكون بصيغة UUID)';
    }

    const shouldNotExistMatch = trimmed.match(/^property\s+(\w+)\s+should not exist$/i);
    if (shouldNotExistMatch) {
      const prop = PROPERTY_NAMES_AR[shouldNotExistMatch[1]] ?? shouldNotExistMatch[1];
      return `الحقل ${prop} غير مسموح بإرساله`;
    }

    const shorterMatch = trimmed.match(/^(.+?)\s+must be shorter than or equal to\s+(\d+)\s+characters$/i);
    if (shorterMatch) {
      const prop = PROPERTY_NAMES_AR[shorterMatch[1]] ?? shorterMatch[1];
      return `${prop} يجب ألا يتجاوز ${shorterMatch[2]} حرفاً`;
    }

    const longerMatch = trimmed.match(/^(.+?)\s+must be longer than or equal to\s+(\d+)\s+characters$/i);
    if (longerMatch) {
      const prop = PROPERTY_NAMES_AR[longerMatch[1]] ?? longerMatch[1];
      return `${prop} يجب ألا يقل عن ${longerMatch[2]} حرفاً`;
    }

    const maxWordsMatch = trimmed.match(/^(.+?)\s+must not exceed\s+(\d+)\s+words$/i);
    if (maxWordsMatch) {
      const prop = PROPERTY_NAMES_AR[maxWordsMatch[1]] ?? maxWordsMatch[1];
      return `${prop} يجب ألا يتجاوز ${maxWordsMatch[2]} كلمة`;
    }

    const minWordsMatch = trimmed.match(/^(.+?)\s+must be at least\s+(\d+)\s+words$/i);
    if (minWordsMatch) {
      const prop = PROPERTY_NAMES_AR[minWordsMatch[1]] ?? minWordsMatch[1];
      return `${prop} يجب ألا يقل عن ${minWordsMatch[2]} كلمة`;
    }

    const stringMatch = trimmed.match(/^(.+?)\s+must be a string$/i);
    if (stringMatch) {
      const prop = PROPERTY_NAMES_AR[stringMatch[1]] ?? stringMatch[1];
      return `${prop} يجب أن يكون نصاً`;
    }

    const emailMatch = trimmed.match(/^(.+?)\s+must be an email$/i);
    if (emailMatch) {
      const prop = PROPERTY_NAMES_AR[emailMatch[1]] ?? emailMatch[1];
      return `${prop} يجب أن يكون بريداً إلكترونياً صالحاً`;
    }

    const numberMatch = trimmed.match(/^(.+?)\s+must be a number$/i);
    if (numberMatch) {
      const prop = PROPERTY_NAMES_AR[numberMatch[1]] ?? numberMatch[1];
      return `${prop} يجب أن يكون رقماً`;
    }

    const boolMatch = trimmed.match(/^(.+?)\s+must be a boolean$/i);
    if (boolMatch) {
      const prop = PROPERTY_NAMES_AR[boolMatch[1]] ?? boolMatch[1];
      return `${prop} يجب أن يكون قيمة منطقية (true/false)`;
    }

    const reqMatch = trimmed.match(/^(.+?)\s+(should not be empty|is required)$/i);
    if (reqMatch) {
      const prop = PROPERTY_NAMES_AR[reqMatch[1]] ?? reqMatch[1];
      return `${prop} مطلوب`;
    }

    const phoneCountryMatch = trimmed.match(
      /^Phone number must be (.+?) for country code (\+\d+)(?: \((.+?)\))?$/i,
    );
    if (phoneCountryMatch) {
      const code = phoneCountryMatch[2];
      const info = COUNTRY_PHONE_INFO[code];
      const digitsAr = info?.digitsAr || phoneCountryMatch[1];
      const exampleAr = info?.example || phoneCountryMatch[3];
      return `رقم الهاتف يجب أن يتكون من ${digitsAr} لكود الدولة ${code}${exampleAr ? ` (مثال: ${exampleAr})` : ''}`;
    }

    const phoneShortMatch = trimmed.match(
      /^Phone number is too short for country code (\+\d+)$/i,
    );
    if (phoneShortMatch) {
      return `رقم الهاتف أقصر من اللازم لكود الدولة ${phoneShortMatch[1]}`;
    }

    const phoneLongMatch = trimmed.match(
      /^Phone number is too long for country code (\+\d+)$/i,
    );
    if (phoneLongMatch) {
      return `رقم الهاتف أطول من اللازم لكود الدولة ${phoneLongMatch[1]}`;
    }

    const phoneInvalidMatch = trimmed.match(
      /^Phone number is invalid for (?:the selected )?country code(?: (\+\d+))?$/i,
    );
    if (phoneInvalidMatch) {
      const code = phoneInvalidMatch[1];
      return code
        ? `رقم الهاتف غير صالح لكود الدولة ${code}`
        : 'رقم الهاتف غير صالح لكود الدولة المحدد';
    }

    return trimmed;
  }
}

const VALIDATION_MESSAGES_AR: Record<string, string> = {
  // Name
  'Name is required': 'الاسم مطلوب',
  'name is required': 'الاسم مطلوب',
  'name should not be empty': 'الاسم مطلوب',
  'name must be a string': 'الاسم يجب أن يكون نصاً',
  'name must be shorter than or equal to 100 characters': 'الاسم يجب ألا يتجاوز 100 حرف',
  'name must be longer than or equal to 2 characters': 'الاسم يجب ألا يقل عن حرفين',
  'Name must be at least 2 characters long': 'الاسم يجب ألا يقل عن حرفين',
  'Name must be at least 2 characters': 'الاسم يجب ألا يقل عن حرفين',
  'name must be at least 2 characters long': 'الاسم يجب ألا يقل عن حرفين',
  'name must be at least 2 characters': 'الاسم يجب ألا يقل عن حرفين',
  'Name must contain letters only (no numbers or symbols)':
    'الاسم يجب أن يحتوي على أحرف فقط (بدون أرقام أو رموز)',
  'Name must contain letters only': 'الاسم يجب أن يحتوي على أحرف فقط (بدون أرقام أو رموز)',
  'name must contain letters only': 'الاسم يجب أن يحتوي على أحرف فقط (بدون أرقام أو رموز)',

  // Email
  'Email is required': 'البريد الإلكتروني مطلوب',
  'email is required': 'البريد الإلكتروني مطلوب',
  'New email is required': 'البريد الإلكتروني الجديد مطلوب',
  'newEmail is required': 'البريد الإلكتروني الجديد مطلوب',
  'email should not be empty': 'البريد الإلكتروني مطلوب',
  'email must be an email': 'البريد الإلكتروني غير صالح',
  'Invalid email address': 'البريد الإلكتروني غير صالح',
  'Email must be at least 6 characters long': 'البريد الإلكتروني يجب ألا يقل عن 6 أحرف',
  'Email must be at least 6 characters': 'البريد الإلكتروني يجب ألا يقل عن 6 أحرف',
  'email must be longer than or equal to 6 characters': 'البريد الإلكتروني يجب ألا يقل عن 6 أحرف',
  'New email must be at least 6 characters long': 'البريد الإلكتروني الجديد يجب ألا يقل عن 6 أحرف',
  'newEmail must be longer than or equal to 6 characters': 'البريد الإلكتروني الجديد يجب ألا يقل عن 6 أحرف',
  'Email must be at least 12 characters long': 'البريد الإلكتروني يجب ألا يقل عن 12 حرفاً',
  'Email cannot exceed 254 characters': 'البريد الإلكتروني يجب ألا يتجاوز 254 حرفاً',
  'email must be longer than or equal to 12 characters': 'البريد الإلكتروني يجب ألا يقل عن 12 حرفاً',
  'email must be shorter than or equal to 254 characters': 'البريد الإلكتروني يجب ألا يتجاوز 254 حرفاً',

  // Phone
  'Phone is required': 'رقم الهاتف مطلوب',
  'phone is required': 'رقم الهاتف مطلوب',
  'phone should not be empty': 'رقم الهاتف مطلوب',
  'phone must be a string': 'رقم الهاتف يجب أن يكون نصاً',
  'Phone must contain digits only': 'رقم الهاتف يجب أن يحتوي على أرقام فقط',
  'Phone must contain digits only (without country code)': 'رقم الهاتف يجب أن يحتوي على أرقام فقط (بدون رمز الدولة)',
  'Phone must be at least 4 digits': 'رقم الهاتف يجب ألا يقل عن 4 أرقام',
  'Phone cannot exceed 14 digits': 'رقم الهاتف يجب ألا يتجاوز 14 رقماً',
  'phone must be longer than or equal to 4 characters': 'رقم الهاتف يجب ألا يقل عن 4 أرقام',
  'phone must be shorter than or equal to 14 characters': 'رقم الهاتف يجب ألا يتجاوز 14 رقماً',

  // Country Code
  'Country code is required': 'كود الدولة مطلوب',
  'countryCode is required': 'كود الدولة مطلوب',
  'country_code is required': 'كود الدولة مطلوب',
  'Country code must be a string': 'كود الدولة يجب أن يكون نصاً',
  'countryCode should not be empty': 'كود الدولة مطلوب',
  'country_code should not be empty': 'كود الدولة مطلوب',
  'countryCode must be a string': 'كود الدولة يجب أن يكون نصاً',
  'country_code must be a string': 'كود الدولة يجب أن يكون نصاً',
  'Country code must start with + followed by 1 to 3 digits (e.g. +1, +20, +966, +971)':
    'كود الدولة يجب أن يبدأ بـ + متبوعاً بـ 1 إلى 3 أرقام (مثال: +20, +966, +971)',

  // Password
  'Password is required': 'كلمة المرور مطلوبة',
  'password is required': 'كلمة المرور مطلوبة',
  'password should not be empty': 'كلمة المرور مطلوبة',
  'password must be a string': 'كلمة المرور يجب أن تكون نصاً',
  'Password must be at least 8 characters long': 'كلمة المرور يجب ألا تقل عن 8 أحرف',
  'Password cannot exceed 74 characters': 'كلمة المرور يجب ألا تتجاوز 74 حرفاً',
  'New password must be at least 8 characters long': 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف',
  'New password cannot exceed 74 characters': 'كلمة المرور الجديدة يجب ألا تتجاوز 74 حرفاً',
  'Password must contain at least one capital letter': 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل',
  'Password must contain at least one number': 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل',
  'password must be longer than or equal to 8 characters': 'كلمة المرور يجب ألا تقل عن 8 أحرف',
  'password must be shorter than or equal to 74 characters': 'كلمة المرور يجب ألا تتجاوز 74 حرفاً',

  // Current & New Password
  'Current password is required': 'كلمة المرور الحالية مطلوبة',
  'currentPassword is required': 'كلمة المرور الحالية مطلوبة',
  'currentPassword must be a string': 'كلمة المرور الحالية يجب أن تكون نصاً',
  'New password is required': 'كلمة المرور الجديدة مطلوبة',
  'newPassword is required': 'كلمة المرور الجديدة مطلوبة',
  'newPassword must be a string': 'كلمة المرور الجديدة يجب أن تكون نصاً',
  'Confirm password is required': 'تأكيد كلمة المرور مطلوب',
  'confirmPassword is required': 'تأكيد كلمة المرور مطلوب',
  'confirmPassword should not be empty': 'تأكيد كلمة المرور مطلوب',
  'confirmPassword must be a string': 'تأكيد كلمة المرور يجب أن يكون نصاً',

  // Profile
  'Profile URL is required': 'رابط الصورة الشخصية مطلوب',
  'profileUrl is required': 'رابط الصورة الشخصية مطلوب',
  'profile_url is required': 'رابط الصورة الشخصية مطلوب',
  'profileUrl should not be empty': 'رابط الصورة الشخصية مطلوب',
  'profile_url should not be empty': 'رابط الصورة الشخصية مطلوب',
  'Profile URL must be a string': 'رابط الصورة الشخصية يجب أن يكون نصاً',
  'profileUrl must be a string': 'رابط الصورة الشخصية يجب أن يكون نصاً',
  'profile_url must be a string': 'رابط الصورة الشخصية يجب أن يكون نصاً',

  'Birthday is required': 'تاريخ الميلاد مطلوب',
  'birthday is required': 'تاريخ الميلاد مطلوب',
  'birthday should not be empty': 'تاريخ الميلاد مطلوب',
  'Birthday must be a valid date format (e.g. YYYY-MM-DD or DD/MM/YYYY)':
    'تاريخ الميلاد يجب أن يكون بصيغة صالحة (مثال: YYYY-MM-DD)',
  'Birthday must be a valid date format (YYYY-MM-DD)':
    'تاريخ الميلاد يجب أن يكون بصيغة صالحة (مثال: YYYY-MM-DD)',

  'Country is required': 'الدولة مطلوبة',
  'country is required': 'الدولة مطلوبة',
  'country should not be empty': 'الدولة مطلوبة',
  'country must be a string': 'اسم الدولة يجب أن يكون نصاً',
  'country must be shorter than or equal to 100 characters': 'اسم الدولة يجب ألا يتجاوز 100 حرف',

  'Reading language is required': 'لغة القراءة مطلوبة',
  'readingLanguage is required': 'لغة القراءة مطلوبة',
  'reading_language is required': 'لغة القراءة مطلوبة',
  'readingLanguage should not be empty': 'لغة القراءة مطلوبة',
  'reading_language should not be empty': 'لغة القراءة مطلوبة',
  'Reading language must be a string': 'لغة القراءة يجب أن تكون نصاً',
  'readingLanguage must be a string': 'لغة القراءة يجب أن تكون نصاً',
  'reading_language must be a string': 'لغة القراءة يجب أن تكون نصاً',
  'Reading language cannot exceed 50 characters': 'لغة القراءة يجب ألا تتجاوز 50 حرفاً',
  'readingLanguage must be shorter than or equal to 50 characters': 'لغة القراءة يجب ألا تتجاوز 50 حرفاً',
  'reading_language must be shorter than or equal to 50 characters': 'لغة القراءة يجب ألا تتجاوز 50 حرفاً',

  'About me cannot exceed 160 characters': 'النبذة الشخصية يجب ألا تتجاوز 160 حرفاً',
  'About me cannot exceed 1000 characters': 'النبذة الشخصية يجب ألا تتجاوز 1000 حرف',
  'aboutMe must be shorter than or equal to 160 characters': 'النبذة الشخصية يجب ألا تتجاوز 160 حرفاً',
  'aboutMe must be shorter than or equal to 1000 characters': 'النبذة الشخصية يجب ألا تتجاوز 1000 حرف',
  'aboutMe must be a string': 'النبذة الشخصية يجب أن تكون نصاً',

  // Code & OTP
  'Code is required': 'رمز التحقق مطلوب',
  'code is required': 'رمز التحقق مطلوب',
  'code should not be empty': 'رمز التحقق مطلوب',
  'code must be a string': 'رمز التحقق يجب أن يكون نصاً',
  'Code must be exactly 6 digits': 'رمز التحقق يجب أن يتكون من 6 أرقام',
  'Channel is required': 'طريقة الإرسال مطلوبة',
  'channel must be a string': 'طريقة الإرسال يجب أن تكون نصاً',
  'Channel must be either email or phone': 'طريقة الإرسال يجب أن تكون إما email أو phone',

  // Language
  'Language is required': 'اللغة مطلوبة',
  'language is required': 'اللغة مطلوبة',
  'Language must be either ar or en': 'اللغة يجب أن تكون ar أو en',
  'language must be either ar or en': 'اللغة يجب أن تكون ar أو en',

  // Tokens
  'Refresh token is required': 'رمز التحديث مطلوب',
  'refreshToken is required': 'رمز التحديث مطلوب',
  'refreshToken should not be empty': 'رمز التحديث مطلوب',
  'refreshToken must be a string': 'رمز التحديث يجب أن يكون نصاً',
  'idToken is required': 'معرف جوجل مطلوب',
  'idToken should not be empty': 'معرف جوجل مطلوب',
  'idToken must be a string': 'معرف جوجل يجب أن يكون نصاً',

  // Common Books & Interests
  'title is required': 'عنوان الكتاب مطلوب',
  'title must be a string': 'عنوان الكتاب يجب أن يكون نصاً',
  'author is required': 'اسم المؤلف مطلوب',
  'author must be a string': 'اسم المؤلف يجب أن يكون نصاً',
  'price must be a number': 'السعر يجب أن يكون رقماً',
  'Interest name is required': 'اسم الاهتمام مطلوب',
  'All interest IDs must be valid UUIDs': 'معرفات الاهتمامات يجب أن تكون بصيغة UUID صالحة',
  'All interest names must be strings': 'أسماء الاهتمامات يجب أن تكون نصوصاً',

  // Terms & Privacy
  'You must accept the terms of use and privacy policy': 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية',
  'Accept terms must be a boolean': 'الموافقة على الشروط يجب أن تكون قيمة منطقية',
  'acceptTerms must be a boolean': 'الموافقة على الشروط يجب أن تكون قيمة منطقية',
  'agreeToTerms must be a boolean': 'الموافقة على الشروط يجب أن تكون قيمة منطقية',
  'acceptTerms is required': 'الموافقة على شروط الاستخدام وسياسة الخصوصية مطلوبة',
  'agreeToTerms is required': 'الموافقة على شروط الاستخدام وسياسة الخصوصية مطلوبة',
  'accept_terms is required': 'الموافقة على شروط الاستخدام وسياسة الخصوصية مطلوبة',
  'agree_to_terms is required': 'الموافقة على شروط الاستخدام وسياسة الخصوصية مطلوبة',

  // File Uploads & Multer Errors (413 Payload Too Large / Limits)
  'File too large': 'حجم الملف يتجاوز الحد الأقصى المسموح به',
  'file too large': 'حجم الملف يتجاوز الحد الأقصى المسموح به',
  'Payload Too Large': 'حجم البيانات يتجاوز الحد الأقصى المسموح به',
  'payload too large': 'حجم البيانات يتجاوز الحد الأقصى المسموح به',
  'Too many files': 'تجاوزت الحد الأقصى لعدد الملفات المسموح بها',
  'too many files': 'تجاوزت الحد الأقصى لعدد الملفات المسموح بها',
  'Field value too long': 'قيمة الحقل أطول من الحد المسموح به',
  'field value too long': 'قيمة الحقل أطول من الحد المسموح به',
  'Field name too long': 'اسم الحقل أطول من الحد المسموح به',
  'field name too long': 'اسم الحقل أطول من الحد المسموح به',
  'Too many parts': 'تجاوزت الحد الأقصى لأجزاء الطلب',
  'too many parts': 'تجاوزت الحد الأقصى لأجزاء الطلب',
  'Too many fields': 'تجاوزت الحد الأقصى لعدد الحقول',
  'too many fields': 'تجاوزت الحد الأقصى لعدد الحقول',
  'Unexpected field': 'حقل غير متوقع في رفع الملفات',
  'unexpected field': 'حقل غير متوقع في رفع الملفات',
  'Validation failed (uuid is expected)':
    'المعرّف المرسل غير صالح (يجب أن يكون بصيغة UUID)',
  'Unauthorized': 'غير مصرح بالوصول',
  'unauthorized': 'غير مصرح بالوصول',
  'Forbidden resource': 'غير مسموح بالوصول لهذا المورد',
  'forbidden resource': 'غير مسموح بالوصول لهذا المورد',
  'Bad Request': 'طلب غير صالح',
  'Not Found': 'العنصر المطلوب غير موجود',
  'not found': 'العنصر المطلوب غير موجود',
  'Internal server error': 'حدث خطأ داخلي في الخادم',

  // DTO Custom Validation Translations
  'All author IDs must be valid UUIDs': 'جميع معرّفات المؤلفين يجب أن تكون بصيغة UUID صالحة',
  'All creator IDs must be valid UUIDs': 'جميع معرّفات صناع المحتوى يجب أن تكون بصيغة UUID صالحة',
  'All interest items must be strings': 'جميع عناصر الاهتمامات يجب أن تكون نصوصاً',
  'Invalid identityType': 'نوع الهوية غير صالح (يجب أن يكون primary أو alias أو anonymous)',
  'Nickname cannot be empty': 'الاسم المستعار مطلوب ولا يمكن أن يكون فارغاً',
  'Nickname cannot exceed 30 characters': 'الاسم المستعار لا يمكن أن يتجاوز 30 حرفاً',
  'Nickname must be a string': 'الاسم المستعار يجب أن يكون نصاً',
  'Progress cannot be less than 0': 'نسبة التقدم لا يمكن أن تقل عن 0',
  'Progress cannot exceed 100': 'نسبة التقدم لا يمكن أن تتجاوز 100',
  'Progress must be an integer between 0 and 100': 'نسبة التقدم يجب أن تكون رقماً صحيحاً بين 0 و 100',
  'Rating cannot be less than 1.0': 'التقييم لا يمكن أن يقل عن 1.0',
  'Rating cannot exceed 5.0': 'التقييم لا يمكن أن يتجاوز 5.0',
  'Rating must be a number between 1.0 and 5.0': 'التقييم يجب أن يكون رقماً بين 1.0 و 5.0',
  'Status must be one of: finished, reading, want_to_read': 'حالة القراءة يجب أن تكون إحدى القيم: finished, reading, want_to_read',
  'aliasId must be a valid UUID': 'معرّف الاسم المستعار يجب أن يكون بصيغة UUID صالحة',
  'content cannot be empty': 'نص المقتطف مطلوب ولا يمكن أن يكون فارغاً',
  'content must be a string': 'نص المقتطف يجب أن يكون نصاً',
  'note cannot exceed 2000 characters': 'الملاحظة يجب ألا تتجاوز 2000 حرف',
  'note must be a string': 'الملاحظة يجب أن تكون نصاً',
  'chapter cannot exceed 150 characters': 'اسم الفصل يجب ألا يتجاوز 150 حرفاً',
  'chapter must be a string': 'اسم الفصل يجب أن يكون نصاً',
  'pageNumber must be an integer': 'رقم الصفحة يجب أن يكون رقماً صحيحاً',
  'pageNumber must be at least 1': 'رقم الصفحة يجب أن يكون 1 على الأقل',
  'color cannot exceed 30 characters': 'لون التمييز يجب ألا يتجاوز 30 حرفاً',
  'color must be a string': 'لون التمييز يجب أن يكون نصاً',
  'cfiRange cannot exceed 255 characters': 'موضع النص (cfiRange) يجب ألا يتجاوز 255 حرفاً',
  'cfiRange must be a string': 'موضع النص (cfiRange) يجب أن يكون نصاً',
  'isDefault must be a boolean': 'حقل الافتراضي يجب أن يكون قيمة منطقية (true/false)',
  'Avatar URL must be a string': 'رابط الصورة الرمزية يجب أن يكون نصاً',
  'Notes must be a string': 'الملاحظات يجب أن تكون نصاً',
  'Reset token must be a string': 'رمز إعادة التعيين يجب أن يكون نصاً',
  'excerptId must be a valid UUID': 'معرف المقتطف يجب أن يكون UUID صالح',
  'quote must be a string': 'نص المقتطف يجب أن يكون نصاً',
  'quote cannot exceed 5000 characters': 'نص المقتطف لا يمكن أن يتجاوز 5000 حرف',
};

const PROPERTY_NAMES_AR: Record<string, string> = {
  name: 'الاسم',
  Name: 'الاسم',
  email: 'البريد الإلكتروني',
  Email: 'البريد الإلكتروني',
  newEmail: 'البريد الإلكتروني الجديد',
  phone: 'رقم الهاتف',
  Phone: 'رقم الهاتف',
  countryCode: 'كود الدولة',
  country_code: 'كود الدولة',
  'Country code': 'كود الدولة',
  'Country Code': 'كود الدولة',
  password: 'كلمة المرور',
  Password: 'كلمة المرور',
  currentPassword: 'كلمة المرور الحالية',
  newPassword: 'كلمة المرور الجديدة',
  confirmPassword: 'تأكيد كلمة المرور',
  profileUrl: 'رابط الصورة الشخصية',
  profile_url: 'رابط الصورة الشخصية',
  'Profile URL': 'رابط الصورة الشخصية',
  birthday: 'تاريخ الميلاد',
  Birthday: 'تاريخ الميلاد',
  country: 'الدولة',
  Country: 'الدولة',
  readingLanguage: 'لغة القراءة',
  reading_language: 'لغة القراءة',
  'Reading language': 'لغة القراءة',
  aboutMe: 'النبذة الشخصية',
  about_me: 'النبذة الشخصية',
  'About me': 'النبذة الشخصية',
  code: 'رمز التحقق',
  Code: 'رمز التحقق',
  channel: 'طريقة الإرسال',
  Channel: 'طريقة الإرسال',
  token: 'التوكن',
  refreshToken: 'رمز التحديث',
  resetToken: 'رمز إعادة التعيين',
  idToken: 'معرف جوجل',
  title: 'العنوان',
  author: 'اسم المؤلف',
  description: 'الوصف',
  category: 'التصنيف',
  acceptTerms: 'الموافقة على شروط الاستخدام وسياسة الخصوصية',
  agreeToTerms: 'الموافقة على شروط الاستخدام وسياسة الخصوصية',
  accept_terms: 'الموافقة على شروط الاستخدام وسياسة الخصوصية',
  agree_to_terms: 'الموافقة على شروط الاستخدام وسياسة الخصوصية',
  price: 'السعر',
  type: 'النوع',
  content: 'المحتوى',
  Content: 'المحتوى',
  interestIds: 'معرفات الاهتمامات',
  interestNames: 'أسماء الاهتمامات',
  language: 'اللغة',
  note: 'الملاحظة',
  notes: 'الملاحظات',
  chapter: 'الفصل',
  pageNumber: 'رقم الصفحة',
  color: 'لون التمييز',
  cfiRange: 'موضع النص',
  excerptId: 'معرف المقتطف',
  quote: 'نص المقتطف',
  nickname: 'الاسم المستعار',
  avatarUrl: 'رابط الصورة الرمزية',
  isDefault: 'الافتراضي',
  rating: 'التقييم',
  progress: 'نسبة الإنجاز',
  status: 'حالة القراءة',
  identityType: 'نوع الهوية',
  aliasId: 'معرف الاسم المستعار',
  authorId: 'معرف المؤلف',
  authorIds: 'معرفات المؤلفين',
  creatorId: 'معرف صانع المحتوى',
  creatorIds: 'معرفات صناع المحتوى',
};

