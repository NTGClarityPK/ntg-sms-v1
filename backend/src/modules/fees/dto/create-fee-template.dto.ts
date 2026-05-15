import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateFeeTemplateMetricDto {
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

export class CreateFeeTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(['Fee', 'Discount'])
  type!: 'Fee' | 'Discount';

  @IsString()
  @IsIn(['Levels', 'Class', 'Class-Section', 'Individual'])
  scope!: 'Levels' | 'Class' | 'Class-Section' | 'Individual';

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFeeTemplateMetricDto)
  metrics!: CreateFeeTemplateMetricDto[];
}

