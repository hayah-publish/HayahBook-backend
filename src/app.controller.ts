import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';
import { I18nService } from './i18n/i18n.service';
import { SetLanguageDto } from './i18n/dto/set-language.dto';
import { AuthService } from './auth/auth.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly i18nService: I18nService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get(['languages', 'app/languages'])
  @HttpCode(HttpStatus.OK)
  getLanguages() {
    return {
      data: this.i18nService.getReadingLanguages(),
      languages: this.i18nService.getSupportedLanguages(),
      defaultLanguage: 'ar',
    };
  }

  @Get(['reading-languages', 'app/reading-languages'])
  @HttpCode(HttpStatus.OK)
  getReadingLanguages() {
    return {
      data: this.i18nService.getReadingLanguages(),
    };
  }

  @Post(['language', 'app/language'])
  @HttpCode(HttpStatus.OK)
  async setLanguage(@Req() req: Request, @Body() body: SetLanguageDto) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : undefined;
    const userId = await this.authService.resolveUserIdFromToken(token);
    return this.authService.setLanguage(userId, body.language);
  }
}
