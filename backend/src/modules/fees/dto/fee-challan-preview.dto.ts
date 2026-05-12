import { IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FeeChallanTemplateEditDto {
  @IsUUID('4')
  templateId!: string;

  @IsString()
  @IsIn(['exclude'])
  action!: 'exclude';
}

export class FeeChallanMetricEditDto {
  @IsUUID('4')
  templateId!: string;

  @IsUUID('4')
  metricId!: string;

  @IsString()
  @IsIn(['exclude', 'overrideAmount'])
  action!: 'exclude' | 'overrideAmount';

  @IsOptional()
  @IsNumber()
  amount?: number;
}

export class FeeChallanPreviewDto {
  @IsString()
  month!: string; // YYYY-MM (validated in service)

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  includeIndividualTemplateIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeChallanMetricEditDto)
  metricEdits?: FeeChallanMetricEditDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeChallanTemplateEditDto)
  templateEdits?: FeeChallanTemplateEditDto[];
}

