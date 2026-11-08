import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { PostsModule } from '../posts/posts.module';
import { AuthModule } from '../auth/auth.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [PostsModule, AuthModule, I18nModule],
  controllers: [HomeController],
})
export class HomeModule {}

