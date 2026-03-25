import { IsOptional, IsIn } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['en', 'en-US', 'en-GB', 'ar'])
  preferred_locale?: string;
}
