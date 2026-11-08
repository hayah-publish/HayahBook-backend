import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { UploadService } from '../upload/upload.service';
import { UploadFile } from '../upload/upload-file.interface';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { GoogleLoginDto } from './dto/google-login.dto';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetPasswordOtpDto } from './dto/verify-reset-password-otp.dto';
import { RequestSignupOtpDto } from './dto/request-signup-otp.dto';
import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';
import { RequestChangeEmailOtpDto } from './dto/request-change-email-otp.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { RequestDeleteAccountOtpDto } from './dto/request-delete-account-otp.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { RequestUpdatePhoneOtpDto } from './dto/request-update-phone-otp.dto';
import { UpdatePhoneDto } from './dto/update-phone.dto';
import { I18nService } from '../i18n/i18n.service';
import { CountriesService } from '../countries/countries.service';
import { SetLanguageDto } from '../i18n/dto/set-language.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

interface OptionalAuthenticatedRequest extends Request {
  user?: any;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
    private readonly countriesService: CountriesService,
    private readonly uploadService: UploadService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() body: SignupDto) {
    return this.authService.signup(body);
  }

  @Post(['otp/signup', 'signup/otp'])
  @HttpCode(HttpStatus.OK)
  async requestSignupOtp(@Body() body: RequestSignupOtpDto) {
    return this.authService.requestSignupOtp(body.email);
  }

  @Post('otp/verify-signup')
  @HttpCode(HttpStatus.OK)
  async verifySignupOtp(@Body() body: VerifySignupOtpDto) {
    return this.authService.verifySignupOtp(body.email, body.code);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('otp/delete-account')
  @HttpCode(HttpStatus.OK)
  async requestDeleteAccountOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: RequestDeleteAccountOtpDto,
  ) {
    return this.authService.requestDeleteAccountOtp(req.user.userId, body.channel);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Req() req: AuthenticatedRequest,
    @Body() body: DeleteAccountDto,
  ) {
    return this.authService.deleteAccount(req.user.userId, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('otp/change-password')
  @HttpCode(HttpStatus.OK)
  async requestChangePasswordOtp(@Req() req: AuthenticatedRequest) {
    return this.authService.requestChangePasswordOtp(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('otp/change-email')
  @HttpCode(HttpStatus.OK)
  async requestChangeEmailOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: RequestChangeEmailOtpDto,
  ) {
    return this.authService.requestChangeEmailOtp(req.user.userId, body.newEmail);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  async changeEmail(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangeEmailDto,
  ) {
    return this.authService.changeEmail(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('otp/update-phone')
  @HttpCode(HttpStatus.OK)
  async requestUpdatePhoneOtp(
    @Req() req: AuthenticatedRequest,
    @Body() body: RequestUpdatePhoneOtpDto,
  ) {
    const countryCode = (body.countryCode ?? body.country_code)!;
    return this.authService.requestUpdatePhoneOtp(
      req.user.userId,
      countryCode,
      body.phone,
      body.channel,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('phone')
  @HttpCode(HttpStatus.OK)
  async updatePhone(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdatePhoneDto,
  ) {
    return this.authService.updatePhone(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(['avatar', 'upload-avatar'])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  async uploadAvatar(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files?: UploadFile[],
  ) {
    const file = files && files.length > 0 ? files[0] : undefined;
    if (!file) {
      throw new BadRequestException(this.i18n.t('upload.file_required'));
    }
    return this.uploadService.uploadAvatar(req.user.userId, file);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('complete-profile')
  @HttpCode(HttpStatus.OK)
  async completeProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() body: RequestOtpDto) {
    await this.authService.requestOtp(body.email);

    return {
      message: this.i18n.t('otp.sent_email'),
    };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.email, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AuthenticatedRequest) {
    await this.authService.logout(req.user.userId);
    return {
      message: this.i18n.t('auth.logged_out'),
    };
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() body: GoogleLoginDto) {
    return this.authService.googleLogin(body.idToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post(['otp/forgot-password'])
  @HttpCode(HttpStatus.OK)
  async forgotPasswordOtp(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body);
  }

  @Post(['otp/verify-reset-password', 'verify-reset-otp', 'otp/verify-reset'])
  @HttpCode(HttpStatus.OK)
  async verifyResetPasswordOtp(@Body() body: VerifyResetPasswordOtpDto) {
    return this.authService.verifyResetPasswordOtp(body);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body);
  }

  @Get('languages')
  @HttpCode(HttpStatus.OK)
  getLanguages() {
    return {
      data: this.i18n.getReadingLanguages(),
      languages: this.i18n.getSupportedLanguages(),
      defaultLanguage: 'ar',
    };
  }

  @Get('reading-languages')
  @HttpCode(HttpStatus.OK)
  getReadingLanguages() {
    return {
      data: this.i18n.getReadingLanguages(),
    };
  }

  @Get('countries')
  @HttpCode(HttpStatus.OK)
  getCountries() {
    return this.countriesService.findAll();
  }

  @Post('language')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async setLanguage(@Req() req: OptionalAuthenticatedRequest, @Body() body: SetLanguageDto) {
    return this.authService.setLanguage(req.user?.userId, body.language);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('language')
  @HttpCode(HttpStatus.OK)
  async patchLanguage(
    @Req() req: AuthenticatedRequest,
    @Body() body: SetLanguageDto,
  ) {
    return this.authService.setLanguage(req.user.userId, body.language);
  }
}
