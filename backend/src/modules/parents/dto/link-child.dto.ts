import { IsUUID, IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

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
}

