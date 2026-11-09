import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { InterestsModule } from './interests/interests.module';
import { CountriesModule } from './countries/countries.module';
import { AuthorsModule } from './authors/authors.module';
import { CreatorsModule } from './creators/creators.module';
import { UploadModule } from './upload/upload.module';
import { PostsModule } from './posts/posts.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { HomeModule } from './home/home.module';
import { CommentsModule } from './comments/comments.module';
import { I18nModule } from './i18n/i18n.module';
import { I18nMiddleware } from './i18n/i18n.middleware';
import { I18nValidationExceptionFilter } from './i18n/i18n-validation.filter';
import { createStepValidationPipe } from './i18n/i18n-validation.pipe';
import { AuthRateLimitMiddleware } from './auth/auth-rate-limit.middleware';
import { AuthSecurityTables1762300000000 } from './database/migrations/1762300000000-auth-security-tables';
import { CreateBookmarksTable1762400000000 } from './database/migrations/1762400000000-create-bookmarks-table';
import { ProfilePrivacyMailReadingIntegrity1762500000000 } from './database/migrations/1762500000000-profile-privacy-mail-reading-integrity';
import { CreatePostReactionsTable1762600000000 } from './database/migrations/1762600000000-create-post-reactions-table';
import { CreateCommentsAndRepliesTables1762700000000 } from './database/migrations/1762700000000-create-comments-and-replies-tables';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const enableSsl =
          config.get<string>('DB_SSL') === 'true' ||
          (url && !url.includes('localhost') && !url.includes('127.0.0.1'));

        const sslOption = enableSsl ? { rejectUnauthorized: true } : false;
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const dbSync = config.get<string>('DB_SYNC');
        const synchronize = dbSync !== undefined ? dbSync === 'true' : !isProd;

        if (url) {
          return {
            type: 'postgres',
            url,
            ssl: sslOption,
            autoLoadEntities: true,
            synchronize,
            migrations: [
              AuthSecurityTables1762300000000,
              CreateBookmarksTable1762400000000,
              ProfilePrivacyMailReadingIntegrity1762500000000,
              CreatePostReactionsTable1762600000000,
              CreateCommentsAndRepliesTables1762700000000,
            ],
            migrationsRun: true,
          };
        }

        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: Number(config.get('DB_PORT', 5432)),
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE', 'books_backend'),
          ssl: sslOption,
          autoLoadEntities: true,
          synchronize,
          migrations: [
            AuthSecurityTables1762300000000,
            CreateBookmarksTable1762400000000,
            ProfilePrivacyMailReadingIntegrity1762500000000,
            CreatePostReactionsTable1762600000000,
            CreateCommentsAndRepliesTables1762700000000,
          ],
          migrationsRun: true,
        };
      },
    }),

    I18nModule,
    BooksModule,
    UsersModule,
    AuthModule,
    InterestsModule,
    CountriesModule,
    AuthorsModule,
    CreatorsModule,
    UploadModule,
    PostsModule,
    BookmarksModule,
    HomeModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuthRateLimitMiddleware,
    {
      provide: APP_FILTER,
      useClass: I18nValidationExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useFactory: () => createStepValidationPipe(),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nMiddleware, AuthRateLimitMiddleware).forRoutes('*');
  }
}
