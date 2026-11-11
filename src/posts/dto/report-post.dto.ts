import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportPostDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reasonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, {
    message: 'يجب ألا تتجاوز تفاصيل البلاغ 160 حرفاً',
  })
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, {
    message: 'يجب ألا تتجاوز تفاصيل البلاغ 160 حرفاً',
  })
  notes?: string;
}

