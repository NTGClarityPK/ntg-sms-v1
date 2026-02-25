import { IsOptional, IsIn } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['en', 'ar'])
  preferred_locale?: string;
}
