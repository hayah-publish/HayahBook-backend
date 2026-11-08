import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Author } from '../authors/author.entity';
import { Creator } from '../creators/creator.entity';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Author, Creator]), I18nModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

