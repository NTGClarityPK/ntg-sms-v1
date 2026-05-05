import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class AcademicYearPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  endDate!: string;
}

class SubjectPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsInt()
  sortOrder!: number;
}

class ClassPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsInt()
  sortOrder!: number;
}

class SectionPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  sortOrder!: number;
}

class LevelPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsInt()
  sortOrder!: number;

  // Note: UI currently sends class *names* here (legacy naming).
  @IsArray()
  @IsString({ each: true })
  classIds!: string[];
}

class AcademicPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectPayloadDto)
  subjects!: SubjectPayloadDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassPayloadDto)
  classes!: ClassPayloadDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionPayloadDto)
  sections!: SectionPayloadDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LevelPayloadDto)
  levels!: LevelPayloadDto[];

  // Present in UI payload but not used by commit RPC (kept for compatibility)
  @IsOptional()
  @IsArray()
  levelClasses?: Array<{ levelId: string; classId: string }>;
}

class SchoolDayPayloadDto {
  @IsInt()
  dayOfWeek!: number;

  @IsBoolean()
  isActive!: boolean;
}

class TimingSlotPayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  sortOrder!: number;
}

class TimingTemplatePayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  periodDurationMinutes!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimingSlotPayloadDto)
  slots!: TimingSlotPayloadDto[];

  // Present in UI payload but not used by commit RPC (kept for compatibility)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classIds?: string[];
}

class SchedulePayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolDayPayloadDto)
  schoolDays!: SchoolDayPayloadDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimingTemplatePayloadDto)
  timingTemplates!: TimingTemplatePayloadDto[];

  // Present in UI payload but not used by commit RPC (kept for compatibility)
  @IsOptional()
  @IsArray()
  classTimingAssignments?: Array<{ classId: string; templateId: string }>;
}

class AssessmentTypePayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsBoolean()
  isTermExamination?: boolean;
}

class GradeRangePayloadDto {
  @IsString()
  @IsNotEmpty()
  letter!: string;

  @IsNumber()
  minPercentage!: number;

  @IsNumber()
  maxPercentage!: number;

  @IsInt()
  sortOrder!: number;
}

class GradeTemplatePayloadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeRangePayloadDto)
  ranges!: GradeRangePayloadDto[];

  // Present in UI payload but not used by commit RPC (kept for compatibility)
  @IsOptional()
  @IsArray()
  classAssignments?: Array<{ classId: string; minimumPassingGrade: string }>;
}

class AssessmentPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentTypePayloadDto)
  assessmentTypes!: AssessmentTypePayloadDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeTemplatePayloadDto)
  gradeTemplates!: GradeTemplatePayloadDto[];

  // Present in UI payload but not used by commit RPC (kept for compatibility)
  @IsOptional()
  @IsArray()
  gradeRanges?: Array<{ templateId: string; range: GradeRangePayloadDto }>;

  // Present in UI payload but not used by commit RPC (kept for compatibility)
  @IsOptional()
  @IsArray()
  classGradeAssignments?: Array<{ classId: string; templateId: string; minimumPassingGrade: string }>;

  @IsOptional()
  @IsInt()
  leaveQuota!: number | null;
}

class CommunicationPayloadDto {
  @IsIn(['teacher_only', 'both'])
  teacherStudent!: 'teacher_only' | 'both';

  @IsIn(['teacher_only', 'both'])
  teacherParent!: 'teacher_only' | 'both';
}

class BehaviorPayloadDto {
  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  mandatory!: boolean;

  @IsArray()
  @IsString({ each: true })
  attributes!: string[];
}

class PermissionPayloadDto {
  @IsString()
  @IsNotEmpty()
  roleId!: string;

  @IsString()
  @IsNotEmpty()
  featureId!: string;

  @IsIn(['none', 'view', 'edit'])
  permission!: 'none' | 'view' | 'edit';
}

export class CommitSetupWizardDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => AcademicYearPayloadDto)
  academicYear!: AcademicYearPayloadDto | null;

  @ValidateNested()
  @Type(() => AcademicPayloadDto)
  academic!: AcademicPayloadDto;

  @ValidateNested()
  @Type(() => SchedulePayloadDto)
  schedule!: SchedulePayloadDto;

  @ValidateNested()
  @Type(() => AssessmentPayloadDto)
  assessment!: AssessmentPayloadDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CommunicationPayloadDto)
  communication!: CommunicationPayloadDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BehaviorPayloadDto)
  behavior!: BehaviorPayloadDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionPayloadDto)
  permissions!: PermissionPayloadDto[];
}

