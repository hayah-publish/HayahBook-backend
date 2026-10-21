
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BooksModule } from './books/books.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

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

        const sslOption = enableSsl ? { rejectUnauthorized: false } : false;
        const synchronize = config.get<string>('DB_SYNC') === 'true';

        if (url) {
          return {
            type: 'postgres',
            url,
            ssl: sslOption,
            autoLoadEntities: true,
            synchronize,
          };
        }

        return {
          type: 'postgres',
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get<string>('DB_USERNAME', 'postgres'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE', 'books_backend'),
          ssl: sslOption,
          autoLoadEntities: true,
          synchronize,
        };
      },
    }),

    BooksModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
