import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [PostsModule],
  controllers: [HomeController],
})
export class HomeModule {}
