import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { InterestsService } from './interests.service';
import { SelectInterestsDto } from './dto/select-interests.dto';
import { CreateInterestDto } from './dto/create-interest.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  async getAllInterests() {
    return this.interestsService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(['my-interests', 'me'])
  async getMyInterests(@Req() req: AuthenticatedRequest) {
    return this.interestsService.getUserInterests(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(['my-interests', 'me'])
  @HttpCode(HttpStatus.OK)
  async saveMyInterests(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SelectInterestsDto,
  ) {
    return this.interestsService.saveUserInterests(req.user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(['my-interests/:interestId', 'me/:interestId'])
  @HttpCode(HttpStatus.OK)
  async removeMyInterest(
    @Req() req: AuthenticatedRequest,
    @Param('interestId') interestId: string,
  ) {
    return this.interestsService.removeUserInterest(req.user.userId, interestId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createInterest(@Body() dto: CreateInterestDto) {
    return this.interestsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':id')
  async removeInterest(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.interestsService.remove(id);
  }
}
