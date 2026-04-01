import { IsBoolean } from 'class-validator';

export class SetTenantActivationDto {
  @IsBoolean()
  isActive!: boolean;
}

