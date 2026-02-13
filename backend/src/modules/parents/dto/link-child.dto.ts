import { IsUUID, IsString, IsOptional, IsBoolean, IsIn, IsInt, Min, Max } from 'class-validator';

export class LinkChildDto {
  @IsUUID()
  studentId!: string;

  @IsString()
  @IsIn(['father', 'mother', 'guardian'])
  relationship!: 'father' | 'mother' | 'guardian';

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  priority?: number; // Optional: if not provided, will be auto-assigned
}

