import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class TenantDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  domain?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  fiscalYearStart?: string | null;

  @IsOptional()
  @IsString()
  vatNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  deletionStatus?: 'none' | 'pending' | 'executing' | null;

  @IsOptional()
  @IsString()
  deletionRequestedAt?: string | null;

  @IsOptional()
  @IsString()
  deletionExecuteAt?: string | null;

  @IsOptional()
  @IsString()
  deletionCancelledAt?: string | null;

  @IsOptional()
  @IsString()
  deletionRequestedBy?: string | null;

  @IsOptional()
  @IsBoolean()
  preDeletionIsActive?: boolean | null;

  constructor(partial: Partial<TenantDto>) {
    Object.assign(this, partial);
  }
}








