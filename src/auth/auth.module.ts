import { AuthController } from './auth.controller';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { EmailOtp } from './otp.entity';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { CountriesModule } from '../countries/countries.module';
import { UploadModule } from '../upload/upload.module';
import { AuthSession } from './auth-session.entity';
import { AuthRateLimit } from './auth-rate-limit.entity';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Module({
  imports: [
    UsersModule,
    CountriesModule,
    UploadModule,
    TypeOrmModule.forFeature([EmailOtp, AuthSession, AuthRateLimit]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET is missing from environment variables');
        }

        return {
          secret,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '30d') as any,
          },
        };
      },
    }),
    PassportModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthRateLimitService],
  exports: [AuthService, AuthRateLimitService],
})
export class AuthModule {}
