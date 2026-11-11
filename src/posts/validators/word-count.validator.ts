import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Strips Markdown syntax to obtain visible text only (excluding Markdown formatting tokens,
 * syntax symbols, blockquote markers, list markers, raw URLs, and HTML tags).
 */
export function extractVisibleText(text?: string | null): string {
  if (!text) return '';

  return (
    text
      // 1. Normalize linebreaks and non-breaking spaces
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/&nbsp;/gi, ' ')
      // 2. Remove fenced code blocks (```...```)
      .replace(/```[\s\S]*?```/g, ' ')
      // 3. Remove inline code (`...`) -> keep code text
      .replace(/`([^`]+)`/g, '$1')
      // 4. Markdown hyperlinks: [label](url) -> keep visible label only
      .replace(/\[([^\]]*)\]\(\s*((?:[^()\s]+|\([^()\s]*\))*)\s*\)/g, '$1')
      // 5. HTML tags: <...> -> remove completely
      .replace(/<[^>]*>/g, ' ')
      // 6. Standalone URLs: https?://... or www.... -> remove from prose word count
      .replace(/(?:https?:\/\/|www\.)\S+/gi, ' ')
      // 7. Blockquote markers at start of lines (> or >> or > >) -> remove markers
      .replace(/^[ \t]*>+[ \t]*/gm, '')
      // 8. Bulleted list markers at start of lines (-, *, + followed by space) -> remove markers
      .replace(/^[ \t]*[*+-][ \t]+/gm, '')
      // 9. Numbered list markers at start of lines (e.g. 1. or 1)) -> remove markers
      .replace(/^[ \t]*\d+[.)][ \t]+/gm, '')
      // 10. Headings (# Title) -> remove leading #
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      // 11. Horizontal rules (---, ***, ___) -> remove
      .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, ' ')
      // 12. Formatting tokens (bold, italics, strikethrough) -> keep inner text
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/~~(.*?)~~/g, '$1')
      // 13. Backslash escaping (e.g. \> or \- or \[) -> unescape to literal character
      .replace(/\\([\\`*_{}[\]()#+.!>~-])/g, '$1')
  );
}

/**
 * Counts visible words in a string accurately, supporting Arabic, English, and rich text Markdown.
 * Strips HTML tags, Markdown syntax (quotes, bullets, numbered lists, links), and filters out
 * pure punctuation or symbol tokens.
 * Matches word counting rules used by Flutter clients.
 */
export function countWords(text?: string | null): number {
  if (!text) return 0;
  const visible = extractVisibleText(text);
  const tokens = visible.trim().split(/\s+/).filter(Boolean);
  // A word must contain at least one Unicode letter or number
  // Supports Arabic letters (with/without tashkeel), Latin, and Eastern Arabic digits
  const wordRegex = /[\p{L}\p{N}]/u;
  return tokens.filter((token) => wordRegex.test(token)).length;
}

@ValidatorConstraint({ name: 'maxWords', async: false })
export class MaxWordsConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return true;
    }
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
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return true;
    }
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
