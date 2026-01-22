import { IsOptional, IsString, IsUUID } from 'class-validator';

export class DeactivateStaffDto {
  @IsOptional()
  @IsUUID()
  replacementStaffId?: string;

  @IsString()
  reason!: string;
}

