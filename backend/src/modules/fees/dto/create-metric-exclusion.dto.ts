import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFeeMetricExclusionDto {
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @IsUUID()
  @IsNotEmpty()
  templateId!: string;

  @IsUUID()
  @IsNotEmpty()
  metricId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

