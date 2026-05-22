import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { IdCardPersonType } from '../types/id-card-person-type';

export class UploadIdCardPhotoDto {
  @IsIn(['student', 'staff', 'admin', 'visitor'])
  personType!: IdCardPersonType;

  @IsOptional()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsString()
  matchKey?: string;
}
