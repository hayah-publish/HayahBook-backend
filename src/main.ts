import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ['1', VERSION_NEUTRAL],
  });

  const configuredOrigins = process.env.CORS_ORIGIN
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && (!configuredOrigins || configuredOrigins.length === 0)) {
    throw new Error('CORS_ORIGIN must be configured in production');
  }
  if (isProduction && configuredOrigins?.some((origin) => origin === '*')) {
    throw new Error('CORS_ORIGIN cannot contain a wildcard in production');
  }
  const corsOrigin = configuredOrigins?.length ? configuredOrigins : true;

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'X-Platform',
      'X-App-Version',
    ],
    exposedHeaders: [
      'Accept-Language',
      'X-Platform',
      'X-App-Version',
    ],
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();
