import { IsOptional, IsString } from 'class-validator';

export class ApproveRejectDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
