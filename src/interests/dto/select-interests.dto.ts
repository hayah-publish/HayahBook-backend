import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class SelectInterestsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'All interest items must be strings' })
  data?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'All interest items must be strings' })
  interestIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'All interest names must be strings' })
  interestNames?: string[];

  @IsOptional()
  @IsIn(['add', 'replace', 'remove'])
  mode?: 'add' | 'replace' | 'remove';
}
