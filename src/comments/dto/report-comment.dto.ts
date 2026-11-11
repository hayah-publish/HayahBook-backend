import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportCommentDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  reasonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'reports.details_too_long' })
  details?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160, { message: 'reports.details_too_long' })
  notes?: string;
}

