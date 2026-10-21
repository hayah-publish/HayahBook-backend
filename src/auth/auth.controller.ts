
import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() body: RequestOtpDto) {
    await this.authService.requestOtp(body.email);

    return {
      message: 'OTP request processed successfully',
    };
  }
  
@Post('verify-otp')
@HttpCode(HttpStatus.OK)
async verifyOtp(@Body() body: VerifyOtpDto) {
  return this.authService.verifyOtp(body.email, body.code);
}

}
