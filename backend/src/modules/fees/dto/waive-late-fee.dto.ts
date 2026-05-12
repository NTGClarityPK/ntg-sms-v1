import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WaiveLateFeeDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

