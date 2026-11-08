import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from './i18n.service';

@Injectable()
@Catch(HttpException)
export class I18nValidationExceptionFilter implements ExceptionFilter {
  constructor(private readonly i18nService: I18nService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const acceptLanguage = request.headers['accept-language'] as string | undefined;
    const queryLang = request.query?.lang as string | undefined;
    const lang = this.i18nService.resolveLanguage(acceptLanguage, queryLang);

    const platform = (request.headers['x-platform'] as string) || 'iOS';
    const appVersion = (request.headers['x-app-version'] as string) || '1.0.0';

    response.setHeader('Accept-Language', lang);
    response.setHeader('X-Platform', platform);
    response.setHeader('X-App-Version', appVersion);

    const status = exception.getStatus?.() ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse();

    let message: unknown;
    let error: string | undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, unknown>;
      message = respObj.message ?? exceptionResponse;
      error = (respObj.error as string) ?? (status === 400 ? 'Bad Request' : undefined);
    } else {
      message = exceptionResponse;
    }

    if (lang === 'ar') {
      if (Array.isArray(message)) {
        message = message.map((msg) =>
          typeof msg === 'string'
            ? this.i18nService.translateValidationMessage(msg, 'ar')
            : msg,
        );
      } else if (typeof message === 'string') {
        message = this.i18nService.translateValidationMessage(message, 'ar');
      }
    }

    return response.status(status).json({
      statusCode: status,
      message,
      ...(error ? { error } : {}),
    });
  }
}

