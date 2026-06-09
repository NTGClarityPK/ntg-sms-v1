import { IsArray, IsIn, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';
import type { IdCardDesignVariant } from '../types/id-card-design-variant';

export class BulkIdCardsPdfDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  cardIds!: string[];

  @IsOptional()
  @IsIn(['single', 'a4_9up'])
  layout?: 'single' | 'a4_9up';

  @IsOptional()
  @IsIn(['classic', 'minimal', 'modern'])
  designVariant?: IdCardDesignVariant;
}
