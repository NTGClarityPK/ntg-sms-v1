import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateParentAssociationDto {
  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;
}
