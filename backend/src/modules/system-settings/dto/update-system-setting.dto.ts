import { IsDefined, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSystemSettingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  key?: string;

  // Accept arbitrary JSON (object/array/primitive). We only enforce presence here.
  @IsDefined()
  value!: unknown;
}


