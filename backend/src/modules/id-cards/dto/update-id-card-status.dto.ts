import { IsArray, IsIn, IsOptional, IsUUID, ArrayMinSize } from 'class-validator';
import type { IdCardStatus } from '../types/id-card-person-type';

export class UpdateIdCardStatusDto {
  @IsIn(['draft', 'approved', 'printed', 'issued', 'revoked'])
  status!: IdCardStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  cardIds?: string[];
}
