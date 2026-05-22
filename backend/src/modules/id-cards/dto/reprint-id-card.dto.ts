import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ReprintIdCardDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeCharged?: number;
}
