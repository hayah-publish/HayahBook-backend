import { Global, Module } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { I18nValidationExceptionFilter } from './i18n-validation.filter';

@Global()
@Module({
  providers: [I18nService, I18nValidationExceptionFilter],
  exports: [I18nService, I18nValidationExceptionFilter],
})
export class I18nModule {}

