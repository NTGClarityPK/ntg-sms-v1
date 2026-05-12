import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

class GenerateChallanMetricEditDto {
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

class GenerateChallanTemplateEditDto {
  @IsUUID('4')
  templateId!: string;

  @IsString()
  @IsIn(['exclude'])
  action!: 'exclude';
}

class GenerateChallanStudentOverrideDto {
  @IsUUID('4')
  studentId!: string;

  @IsString()
  month!: string; // YYYY-MM (validated in service)

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  includeIndividualTemplateIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateChallanMetricEditDto)
  metricEdits?: GenerateChallanMetricEditDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateChallanTemplateEditDto)
  templateEdits?: GenerateChallanTemplateEditDto[];
}

export class GenerateFeeChallansDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  studentIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  months!: string[]; // YYYY-MM

  @IsOptional()
  @IsBoolean()
  autoCalculateDueDate?: boolean;

  @IsOptional()
  @IsDateString()
  dueDate?: string; // ISO date

  /**
   * Optional custom billing period dates (display-only on challan PDF).
   * Expected to be within the primary billing month.
   */
  @IsOptional()
  @IsDateString()
  billingStartDate?: string; // ISO date

  @IsOptional()
  @IsDateString()
  billingEndDate?: string; // ISO date

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GenerateChallanStudentOverrideDto)
  studentOverrides?: GenerateChallanStudentOverrideDto[];

  @IsOptional()
  @IsUUID('4')
  selectedInheritedTemplateId?: string;
}

