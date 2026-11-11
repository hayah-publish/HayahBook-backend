import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export interface NicknameValidationResult {
  isValid: boolean;
  message: string;
  messageEn: string;
}

/**
 * Validates nickname format according to platform rules:
 * - Length: 2 to 30 characters
 * - No spaces allowed
 * - Allowed characters: Underscore (_), Digits (0-9 / ٠-٩), Arabic letters OR English letters
 * - No mixing of Arabic and English letters (either purely Arabic or purely English)
 * - Must contain at least one letter
 */
export function validateNicknameFormat(
  nickname?: string | null,
  _lang: 'ar' | 'en' = 'ar',
): NicknameValidationResult {
  if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
    return {
      isValid: false,
      message: 'الاسم المستعار مطلوب ولا يمكن أن يكون فارغاً',
      messageEn: 'Nickname is required and cannot be empty',
    };
  }

  const trimmed = nickname.trim();

  if (/\s/.test(trimmed)) {
    return {
      isValid: false,
      message:
        'لا يُسمح بوجود مسافات في الاسم المستعار؛ يمكنك استخدام الشرطة السفلية _ بدلاً منها',
      messageEn:
        'Spaces are not allowed in nickname; you can use underscore _ instead',
    };
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      message: 'الاسم المستعار يجب أن يتكون من حرفين على الأقل',
      messageEn: 'Nickname must be at least 2 characters long',
    };
  }

  if (trimmed.length > 30) {
    return {
      isValid: false,
      message: 'الاسم المستعار لا يمكن أن يتجاوز 30 حرفاً',
      messageEn: 'Nickname cannot exceed 30 characters',
    };
  }

  const hasEnglish = /[a-zA-Z]/.test(trimmed);
  const hasArabic = /[\u0621-\u064A]/.test(trimmed);

  if (hasEnglish && hasArabic) {
    return {
      isValid: false,
      message:
        'لا يمكن الخلط بين الحروف العربية والإنجليزية في الاسم المستعار؛ يجب أن يكون بالكامل بالعربية أو بالإنجليزية',
      messageEn:
        'Mixing Arabic and English letters is not allowed; nickname must be entirely in Arabic or English',
    };
  }

  if (!hasEnglish && !hasArabic) {
    return {
      isValid: false,
      message:
        'يجب أن يحتوي الاسم المستعار على حرف واحد على الأقل (عربي أو إنجليزي)',
      messageEn:
        'Nickname must contain at least one letter (Arabic or English)',
    };
  }

  if (hasEnglish) {
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return {
        isValid: false,
        message:
          'مسموح فقط بالحروف الإنجليزية، الأرقام، والعلامة _ دون مسافات أو رموز أخرى',
        messageEn:
          'Only English letters, numbers, and underscore _ are allowed without spaces or other symbols',
      };
    }
  }

  if (hasArabic) {
    if (!/^[\u0621-\u064A\u0660-\u06690-9_]+$/.test(trimmed)) {
      return {
        isValid: false,
        message:
          'مسموح فقط بالحروف العربية، الأرقام، والعلامة _ دون مسافات أو رموز أخرى',
        messageEn:
          'Only Arabic letters, numbers, and underscore _ are allowed without spaces or other symbols',
      };
    }
  }

  return {
    isValid: true,
    message: 'الاسم المستعار صالح',
    messageEn: 'Nickname is valid',
  };
}

export function IsValidNickname(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidNickname',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (value === undefined || value === null) return true;
          return validateNicknameFormat(value).isValid;
        },
        defaultMessage(args: ValidationArguments) {
          const res = validateNicknameFormat(args.value);
          return res.message;
        },
      },
    });
  };
}
