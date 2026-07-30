import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateGoogleWorkspaceSettingsDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isFeatureEnabled!: boolean;
}
