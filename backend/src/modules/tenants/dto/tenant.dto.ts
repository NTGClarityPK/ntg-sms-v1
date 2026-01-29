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
  @IsBoolean()
  isActive?: boolean;

  constructor(partial: Partial<TenantDto>) {
    Object.assign(this, partial);
  }
}


