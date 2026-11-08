import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class FollowMultipleAuthorsDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'All author IDs must be valid UUIDs' })
  data?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'All author IDs must be valid UUIDs' })
  authorIds?: string[];
}

