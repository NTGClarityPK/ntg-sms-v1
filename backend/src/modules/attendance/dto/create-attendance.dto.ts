import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export class CreateAttendanceDto {
  @IsUUID()
  studentId!: string;

  @IsEnum(['present', 'absent', 'late', 'excused'])
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  entryTime?: string;

  @IsOptional()
  @IsString()
  exitTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}



