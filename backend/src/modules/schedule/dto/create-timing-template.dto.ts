import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateTimingTemplateDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  /**
   * Time values are stored as Postgres TIME (e.g. \"07:30\" or \"07:30:00\").
   * We validate as strings here to avoid timezone/date concerns.
   */
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsOptional()
  @IsString()
  assemblyStart?: string;

  @IsOptional()
  @IsString()
  assemblyEnd?: string;

  @IsOptional()
  @IsString()
  breakStart?: string;

  @IsOptional()
  @IsString()
  breakEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  periodDurationMinutes?: number;
}


