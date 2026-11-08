import { IsIn, IsOptional } from 'class-validator';

export class RequestDeleteAccountOtpDto {
  @IsOptional()
  @IsIn(['email', 'phone'], { message: 'Channel must be either email or phone' })
  channel?: 'email' | 'phone';
}

