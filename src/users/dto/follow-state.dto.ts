import { IsBoolean, IsOptional } from 'class-validator';

export class FollowStateDto {
  @IsOptional()
  @IsBoolean()
  follow?: boolean;
}
