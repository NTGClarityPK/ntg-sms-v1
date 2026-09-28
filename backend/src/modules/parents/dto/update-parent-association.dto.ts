import { IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateParentAssociationDto {
  @IsOptional()
  @IsBoolean()
  canApprove?: boolean;

  @IsOptional()
  @IsIn(['father', 'mother', 'guardian'])
  relationship?: 'father' | 'mother' | 'guardian';
}
