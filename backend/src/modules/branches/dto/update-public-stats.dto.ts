import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePublicStatsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  password?: string | null;
}
