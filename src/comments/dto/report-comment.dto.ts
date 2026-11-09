import { IsOptional, IsString } from 'class-validator';

export class ReportCommentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
