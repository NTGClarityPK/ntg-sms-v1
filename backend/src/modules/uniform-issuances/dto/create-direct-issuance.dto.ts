import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateDirectIssuanceDto {
  @IsUUID()
  studentId!: string;

  @IsUUID()
  uniformItemId!: string;

  @IsString()
  size!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
