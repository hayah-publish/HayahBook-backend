import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { I18nService } from './i18n.service';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
  constructor(private readonly i18nService: I18nService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const headerLang = req.headers['accept-language'] as string | undefined;
    const queryLang = req.query.lang as string | undefined;

    const resolved = this.i18nService.resolveLanguage(headerLang, queryLang);

    const platform = (req.headers['x-platform'] as string) || 'iOS';
    const appVersion = (req.headers['x-app-version'] as string) || '1.0.0';

    res.setHeader('Accept-Language', resolved);
    res.setHeader('X-Platform', platform);
    res.setHeader('X-App-Version', appVersion);

    this.i18nService.runWithLanguage(resolved, () => next());
  }
}

