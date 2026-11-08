import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interest } from './interest.entity';
import { User } from '../users/user.entity';
import { InterestsService } from './interests.service';
import { InterestsController } from './interests.controller';
import { CategoriesController } from './categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Interest, User])],
  controllers: [InterestsController, CategoriesController],
  providers: [InterestsService],
  exports: [InterestsService],
})
export class InterestsModule {}
