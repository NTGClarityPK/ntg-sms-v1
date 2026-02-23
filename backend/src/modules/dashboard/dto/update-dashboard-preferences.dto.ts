import { IsArray, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateDashboardPreferencesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  widgetIds?: string[];

  @IsOptional()
  @IsUUID()
  selectedRoleId?: string;

  @IsOptional()
  @IsObject()
  layout?: Record<string, unknown>;
}
