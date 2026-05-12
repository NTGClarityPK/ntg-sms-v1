import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyFeePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;
}

export class RejectFeePaymentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

