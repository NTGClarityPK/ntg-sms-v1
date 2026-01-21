import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsArray, ValidateNested } from 'class-validator';

export class CreateTimingSlotDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

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
  @IsInt()
  @Min(1)
  periodDurationMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTimingSlotDto)
  slots?: CreateTimingSlotDto[];
}


