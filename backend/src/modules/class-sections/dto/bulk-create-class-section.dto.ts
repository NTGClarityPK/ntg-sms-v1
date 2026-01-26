import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateClassSectionDto } from './create-class-section.dto';

export class BulkCreateClassSectionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClassSectionDto)
  classSections!: CreateClassSectionDto[];
}

