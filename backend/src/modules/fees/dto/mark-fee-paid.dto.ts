import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class MarkFeePaidDto {
  @IsUUID()
  challanId!: string;

  /** YYYY-MM-DD; defaults to today if omitted */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
