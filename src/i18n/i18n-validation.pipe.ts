import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

const PROPERTY_PRIORITY: string[] = [
  'name',
  'email',
  'countryCode',
  'country_code',
  'phone',
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'code',
  'channel',
  'language',
  'data',
  'interestIds',
  'authorIds',
  'interests',
  'title',
  'cover',
  'category',
  'content',
  'author',
  'price',
  'description',
  'acceptTerms',
  'agreeToTerms',
  'accept_terms',
  'agree_to_terms',
];

const CONSTRAINT_PRIORITY: string[] = [
  'isNotEmpty',
  'isDefined',
  'isString',
  'isNumber',
  'isBoolean',
  'minLength',
  'isEmail',
  'isUuid',
  'matches',
  'isValidPhoneForCountry',
  'maxLength',
  'min',
  'max',
  'equals',
];

function getPropertyRank(prop: string): number {
  const index = PROPERTY_PRIORITY.indexOf(prop);
  return index === -1 ? 999 : index;
}

function getConstraintRank(constraint: string): number {
  const index = CONSTRAINT_PRIORITY.indexOf(constraint);
  return index === -1 ? 999 : index;
}

export function pickFirstValidationError(errors: ValidationError[]): string {
  if (!errors || errors.length === 0) return 'Validation failed';

  function flattenErrors(errList: ValidationError[]): ValidationError[] {
    const result: ValidationError[] = [];
    for (const err of errList) {
      if (err.constraints && Object.keys(err.constraints).length > 0) {
        result.push(err);
      }
      if (err.children && err.children.length > 0) {
        result.push(...flattenErrors(err.children));
      }
    }
    return result;
  }

  const flattened = flattenErrors(errors);
  if (flattened.length === 0) return 'Validation failed';

  const sortedErrors = [...flattened].sort(
    (a, b) => getPropertyRank(a.property) - getPropertyRank(b.property),
  );

  const firstError = sortedErrors[0];
  const constraints = firstError.constraints || {};
  const sortedConstraintKeys = Object.keys(constraints).sort(
    (a, b) => getConstraintRank(a) - getConstraintRank(b),
  );

  return sortedConstraintKeys.length > 0
    ? constraints[sortedConstraintKeys[0]]
    : 'Validation failed';
}

export function createStepValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) => {
      const firstMessage = pickFirstValidationError(errors);
      return new BadRequestException([firstMessage]);
    },
  });
}

