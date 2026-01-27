import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from './create-attendance.dto';

export class UpdateAttendanceDto {
  @IsOptional()
  @IsEnum(['present', 'absent', 'late', 'excused'])
  status?: AttendanceStatus;

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


