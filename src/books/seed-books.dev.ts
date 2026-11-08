import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BooksService } from './books.service';

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development catalog seeding is disabled in production');
  }
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(BooksService).seedDevelopmentCatalog();
  } finally {
    await app.close();
  }
}

void seed().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Seed failed'}\n`);
  process.exitCode = 1;
});
