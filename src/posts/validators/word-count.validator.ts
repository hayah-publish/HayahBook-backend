import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Counts words in a string accurately, supporting Arabic, English, and rich text.
 * Strips HTML tags, converts HTML non-breaking spaces, and splits on whitespace.
 */
export function countWords(text?: string | null): number {
  if (!text) return 0;
  const stripped = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

@ValidatorConstraint({ name: 'maxWords', async: false })
export class MaxWordsConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    const max = args.constraints[0] as number;
    return countWords(value) <= max;
  }

  defaultMessage(args: ValidationArguments): string {
    const max = args.constraints[0] as number;
    return `${args.property} must not exceed ${max} words`;
  }
}

export function MaxWords(max: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [max],
      validator: MaxWordsConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'minWords', async: false })
export class MinWordsConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    const min = args.constraints[0] as number;
    return countWords(value) >= min;
  }

  defaultMessage(args: ValidationArguments): string {
    const min = args.constraints[0] as number;
    return `${args.property} must be at least ${min} words`;
  }
}

export function MinWords(min: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [min],
      validator: MinWordsConstraint,
    });
  };
}
