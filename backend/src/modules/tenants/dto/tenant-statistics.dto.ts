import { IsString, IsOptional, IsInt, IsArray } from 'class-validator';

export class TenantAdminInfo {
  @IsString()
  userId!: string;

  @IsString()
  email!: string;

  @IsOptional()
  @IsString()
  fullName?: string | null;
}

export class TenantStatisticsDto {
  @IsString()
  tenantId!: string;

  @IsString()
  tenantName!: string;

  @IsString()
  tenantCode!: string;

  @IsInt()
  totalBranches!: number;

  @IsInt()
  totalUsers!: number;

  @IsInt()
  totalStudents!: number;

  @IsArray()
  schoolAdmins!: TenantAdminInfo[];

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
  @IsInt()
  totalStaff?: number;
}
