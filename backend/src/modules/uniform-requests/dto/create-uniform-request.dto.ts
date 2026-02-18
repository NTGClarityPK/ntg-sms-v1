import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateUniformRequestItemDto {
  @IsUUID()
  uniformItemId!: string;

  @IsString()
  size!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateUniformRequestDto {
  @IsUUID()
  studentId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUniformRequestItemDto)
  items!: CreateUniformRequestItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
