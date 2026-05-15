import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import type { FeeTemplateScope, FeeTemplateType } from './fee-template.dto';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, ValidateNested } from 'class-validator';

export class UpdateFeeTemplateMetricDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(['Absolute', 'Percentage'])
  amountType!: 'Absolute' | 'Percentage';

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsBoolean()
  perDay?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}

export class UpdateFeeTemplateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Fee', 'Discount'])
  type?: FeeTemplateType;

  @IsOptional()
  @IsString()
  @IsIn(['Levels', 'Class', 'Class-Section', 'Individual'])
  scope?: FeeTemplateScope;

  @IsOptional()
  @IsString()
  @IsIn(['PKR', 'IQD', 'SAR', 'USD'])
  currencyCode?: 'PKR' | 'IQD' | 'SAR' | 'USD';

  @IsOptional()
  @IsBoolean()
  autoApply?: boolean;

  @IsOptional()
  @IsObject()
  autoApplyCondition?: Record<string, unknown> | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  daysUntilDue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateFeeTemplateMetricDto)
  metrics?: UpdateFeeTemplateMetricDto[];
}

