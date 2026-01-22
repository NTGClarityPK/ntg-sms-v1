import { IsArray, IsEnum, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PermissionItemDto {
  @IsUUID()
  roleId!: string;

  @IsUUID()
  featureId!: string;

  @IsEnum(['none', 'view', 'edit'])
  permission!: 'none' | 'view' | 'edit';
}

export class PermissionMatrixDto {
  roleId!: string;
  roleName!: string;
  featureId!: string;
  featureCode!: string;
  permission!: 'none' | 'view' | 'edit';
  branchId!: string;
  updatedAt!: string;

  constructor(partial: Partial<PermissionMatrixDto>) {
    Object.assign(this, partial);
  }
}

export class UpdatePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions!: PermissionItemDto[];
}

