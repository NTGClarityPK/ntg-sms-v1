import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateFeePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  challanId!: string;

  @IsNumber()
  @Min(0)
  amountPaid!: number;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  @IsIn(['Bank_Transfer', 'Cash', 'Online', 'Cheque'])
  paymentMethod!: 'Bank_Transfer' | 'Cash' | 'Online' | 'Cheque';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;
}

