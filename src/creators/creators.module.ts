import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Creator } from './creator.entity';
import { UserCreatorFollow } from './user-creator-follow.entity';
import { User } from '../users/user.entity';
import { Interest } from '../interests/interest.entity';
import { CreatorsService } from './creators.service';
import { CreatorsController } from './creators.controller';
import { I18nModule } from '../i18n/i18n.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Creator, UserCreatorFollow, User, Interest]),
    I18nModule,
    AuthModule,
  ],
  controllers: [CreatorsController],
  providers: [CreatorsService],
  exports: [CreatorsService],
})
export class CreatorsModule {}

