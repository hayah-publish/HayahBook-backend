import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import type { SupportedLanguage } from '../i18n.types';

export class SetLanguageDto {
  @IsString()
  @IsNotEmpty({ message: 'Language is required' })
  @IsIn(['ar', 'en'], { message: 'Language must be either ar or en' })
  language: SupportedLanguage;
}
