import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class FollowMultipleCreatorsDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'All creator IDs must be valid UUIDs' })
  data?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'All creator IDs must be valid UUIDs' })
  creatorIds?: string[];
}

