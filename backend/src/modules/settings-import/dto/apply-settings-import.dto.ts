import { IsNotEmpty, IsString } from 'class-validator';

export class ApplySettingsImportDto {
  @IsString()
  @IsNotEmpty()
  validationToken!: string;
}

