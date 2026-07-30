import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { SUPPORTED_UI_LOCALES } from '../../../common/utils/locale.util';

export class UpdatePreferencesDto {
  /**
   * Personal UI language override.
   * Pass `null` to clear the override and inherit the tenant default.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn([...SUPPORTED_UI_LOCALES])
  preferred_locale?: string | null;
}
