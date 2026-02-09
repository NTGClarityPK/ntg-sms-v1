import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitConsentDto {
  @IsEnum(['approved', 'rejected'])
  @IsNotEmpty()
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}

