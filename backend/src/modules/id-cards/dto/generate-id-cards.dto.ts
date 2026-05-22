import { IsArray, IsIn, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';
import type { IdCardPersonType } from '../types/id-card-person-type';
import type { IdCardDesignVariant } from '../types/id-card-design-variant';

export class GenerateIdCardsDto {
  @IsIn(['student', 'staff', 'admin', 'visitor'])
  personType!: IdCardPersonType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  personIds?: string[];

  @IsOptional()
  @IsUUID()
  classSectionId?: string;

  /** Staff role filter (roles.id) when generating staff cards without explicit personIds. */
  @IsOptional()
  @IsUUID()
  staffRoleId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsIn(['classic', 'minimal', 'modern'])
  designVariant?: IdCardDesignVariant;
}
